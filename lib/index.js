require('dotenv').config();
if (!process.env.confluence_username) {
  throw new Error('.envに接続情報を設定してください');
}
const argv = require('minimist')(process.argv.slice(2));
const markdown2confluence = require("markdown2confluence-cws");
const frontMatter = require('front-matter');
const marked = require('marked');
const fs = require('fs');
const path = require('path');
const Confluence = require("confluence-api");
const config = {
  username: process.env.confluence_username || "hoge@gmail.com",
  password: process.env.confluence_password || "secret-api-key",
  baseUrl:  process.env.confluence_base_url || "https://hoge.atlassian.net/wiki",
};
const confluenceSpace = process.env.confluence_space;
const mdLinkNotation = process.env.md_link_notation || 'wiki';
const myAppLabel = process.env.my_app_label || 'md2confluence';

const confluence = new Confluence(config);

const mdFile = argv._[0];
const fm = readMd(mdFile);
let mdWikiData = markdown2confluence(fm.body);
mdWikiData = replaceMdLink(mdWikiData, mdFile);

post(confluenceSpace, fm.attributes.title, mdWikiData, fm.attributes.parent);

function post(space, title, content, parentTitle) {
  let oldDoc;
  let labels = [{prefix: 'global', name: myAppLabel}];
  let parentDoc;
  getContentByPageTitle(space, title)
  .then((data) => {
    oldDoc = data;
    if (oldDoc.results.length > 0) {
      docId = oldDoc.results[oldDoc.results.length-1].id;
      return getLabels(docId);
    } 
    return Promise.resolve(null);
  })
  .then((data) => {
    const labelResults = data;
    // { results: [ { prefix: 'global', name: 'pg', id: '3899503', label: 'pg' } ], ... }
    if (labelResults != null) {
      labels = labelResults.results;
      const filterd = labels.filter(label => {
        return label.name === myAppLabel;
      });
      if (filterd.length === 0) {
        return Promise.reject(new Error(`title=「${title}」のページは、md2conflence 以外で作成されています。念のため既存のページを確認して、上書きしても大丈夫な場合は、ラベル「${myAppLabel}」を追加したうえで、再実行してください。もしも上書きしてはダメなページだったら、titleを別のものに変えてから再実行してください。`));
      }
    }
    if (parentTitle && parentTitle.length > 0) {
      return getContentByPageTitle(space, parentTitle);
    }
    return Promise.resolve(null);
  })
  .then((data) => {
    parentDoc = data;
    if (!parentDoc || parentDoc.results.length === 0) {
      return postContent(space, parentTitle, '', null);
    }
    return Promise.resolve(parentDoc.results[0]);
  })
  .then((data) => {
    parentDoc = data;
    const parentId = (parentDoc != null) ? parentDoc.id: null;
    if (oldDoc.results.length > 0) {
      const doc = oldDoc.results[0];
      const v = doc.version.number + 1;
      return putContent(doc.id, v, doc.title, content, parentId);
    } else {
      return postContent(space, title, content, parentId);
    }
  })
  .then((data) => {
    const doc = data;
    return postLabels(doc.id, labels);
  })
  .then((data) => {
    console.log('success');
  })
  .catch((err) => {
    console.error(err);
  });
}

function getContentByPageTitle(space, title) {
  return new Promise((resolve, reject) => {
    title = encodeURIComponent(title);
    confluence.getContentByPageTitle(space, title, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}
function postContent(space, title, content, parentId) {
  return new Promise((resolve, reject) => {
    const representation = 'wiki';
    confluence.postContent(space, title, content, parentId, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    }, representation);
  });
}
function putContent(id, version, title, content, parentId) {
  return new Promise((resolve, reject) => {
    const minorEdit = false;
    const representation = 'wiki';
    confluence.putContent(id, version, title, content, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    }, minorEdit, representation, parentId);
  });
}
function getLabels(id) {
  return new Promise((resolve, reject) => {
    confluence.getLabels(id, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}
function postLabels(id, labels) {
  return new Promise((resolve, reject) => {
    confluence.postLabels(id, labels, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}
function convertWikiMarkup(content) {
  return new Promise((resolve, reject) => {
    confluence.convertWikiMarkup(content, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

function replaceMdLink(srcText, mdFile) {
  // リンクを置換
  let work = srcText;
  let replaced = '';
  do {
    const matches = work.match(/\[(.*?)\|(.*?)\]/);
    if (matches === null) {
      break;
    }
    replaced += work.substr(0, matches.index);
    if (matches[2].match(/^#/)) {
      replaced += matches[0];
    } else {
      const linkText = findDocTitle(matches[2], mdFile);
      replaced += `[${matches[1]}|${linkText}]`;
    }
    work = work.substr(matches.index+matches[0].length);
  } while (true);
  replaced += work;
  return replaced;
}
function findDocTitle(link, mdFile) {
  const linkFile = link.replace(/\/?#.*/, '');
  const linkSection = link.replace(/.*#(.*)/, '$1');
  const to = linkFile + ((mdLinkNotation === 'wiki') ? '.md' : '');
  const toFile = path.join(path.dirname(mdFile), to);
  const fm = readMd(toFile);
  if (linkSection) {
    if (!existsLink(fm.body, linkSection)) {
      throw new Error(`${toFile} の中に "${linkSection}" の見出しがありません`)
    }
  }
  return fm.attributes.title;
}
function readMd(file) {
  try {
    fs.statSync(file);
  } catch (err) {
    throw new Error(`${file}がありません`);
  }
  const md = fs.readFileSync(file, 'utf8');
  const fm = frontMatter(md);
  if (!fm.frontmatter) {
    throw new Error(`${file}にfrontmatterがありません`);
  }
  if (!fm.attributes.title) {
    throw new Error('${file}のfrontmatterにtitleがありません');
  }
  if (!fm.attributes.parent) {
    throw new Error('${file}のfrontmatterにparentがありません');
  }
  return fm;
}
function existsLink(doc, linkText) {
  const lexer = new marked.Lexer({
    gfm: true,
  });
  const tokens = lexer.lex(doc);
  const headingTokens = tokens.filter(token => {
    return token.type === 'heading' && token.text === linkText;
  });
  return headingTokens.length > 0;
}


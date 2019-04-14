md2confluence
=============

マークダウンで記述したドキュメントを Confluence の wiki マークアップに変換して、
且つ、 Confluence API で、ページを post します。

ユーザーと共有するドキュメントは、Confluence なんだけど、開発チームでは、github  の wiki で仕様書を書いている・・・というケースで使ってください。

npm では公開していないので、github の wiki を clone したディレクトリで、npm init から、追加してください。

## 1. 準備（初回だけ）

### 1.1. npm の準備

```bash
npm init
npm install github:a5doc/md2confluence

```

### 1.2. package.json に scripts を追加

```json
{
  ・・・
  "scripts": {
    "md2c": "node node_modules/md2confluence/lib/index.js"
  },
  ・・・
}
```

### 1.3. API トークン を作成

Confluence の API を使用するので、自分のアカウントで、 API トークン を作成してください。  
※API トークンの作成方法は、こちらにあります。  
https://ja.confluence.atlassian.com/cloud/api-tokens-938839638.html

### 1.4. Confluence への接続情報を登録

Confluence への接続情報を環境変数に登録してください。  
`.env`ファイルに登録しておくと、実行時に読み込まれます。
```
confluence_username="hoge@example.com"
confluence_password="XXXXXXXXXXXX"
confluence_base_url="https://hoge.atlassian.net/wiki"
confluence_space=test
my_app_label=md2c
md_link_notation=wiki
```

* **confluence_username**  
    Confluenceアカウントのメールアドレス
* **confluence_password**  
    API トークンを設定してください
* **confluence_base_url**  
    ConfluenceのURLを設定してください。
    "/wiki" も必要です。
* **confluence_space**  
    スペースの名前
* **my_app_label**  
    このツールで、他の人が普通に記述したページを上書きしないように、このツールが登録したページには、ラベルを付けて区別します。
    そのラベル名を指定してください。
* **md_link_notation**  
    githubのwikiのmdをConfluenceに登録することを想定していますが、wikiじゃなくて、コードのリポジトリにあるmdを登録する場合は、md中のリンクの記述が違うので、そのモード切替を可能にしてます。
    * **wiki**: wikiのmd
    * **md**: コードのリポジトリのmd

### 1.5. .gitignore 

不要なコミットを避けるために、 .gitignore を作成します。
```
node_modules
.env
```

### 1.6. コミット

package.json なども、wikiに一緒にコミットしてしまって良いと思います。
```
git add package*.json
git add .gitignore
git commit
```

## 2. ページ投稿

### 2.1. md ファイルの作成

md ファイルには、 front matter を付けます。

記述例
```markdown
---
title: アカウント管理画面
parent: 画面仕様
---

**機能概要:**
アカウント管理画面の仕様について記載する。

**入力:** 
* パラメータ1
* パラメータ2
* パラメータ3

**処理詳細:** 

・・・・

```

文書の先頭の`---`で挟まれた部分を front matter と言います。
この中に、文書の属性を記述します。  
このツールで必要なのは、以下です。
* **title**  
    Confluenceにも、このページタイトルで登録します。  
    このツールでは、同じページ名が既に登録されているかを確認して、
    未登録だったら、そのまま登録します。
    既録済のページがある場合は、そのページに my_app_label で指定されたラベルが付いているかを確認して、ラベルが付いている場合に、ページを更新して、ラベルが付いていない場合には、エラーで終了します。
* **parent**  
    ページを登録するConfluenceの親ページのタイトルです。

mdは、内部的に[markdown2confluence-cws](https://www.npmjs.com/package/markdown2confluence-cws)を使って、Confluenceのwikiマークアップに変換して登録されます。  

また、2次変換処理として、 front matter に設定された値で、mdのリンクをConfluence上でのリンクに置き換えています。  
例えば、md上では、`[アカウント 画面仕様](../ui-spec/account)` とリンクが記載されているとしたら、2次変換処理は、 ../data-spec/account.md を開いて、 front matter に設定されてある title を使って、 `[アカウント 画面仕様|アカウント管理画面]` と置換します。

さらに、 parent を使って、ページ登録時の親ページを紐づけます。親ページが存在しない場合は、ブランクのページを登録したうえで、紐づけします。

### 2.2. Confluence への登録と更新

次のコマンドで、登録してください。
```
npm run md2c xxxx.md
```
※xxxx.md は登録対象のmdファイルです。


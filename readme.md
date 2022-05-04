# the zoup reference implementation prototype

this is a prototypical implementation of the [zoup](https://zoup.io/) [spec](https://github.com/zoupio/spec/blob/main/spec.md).
it's not for production use as of yet.

## somewhat working so far

* setup
* login, logout
* posting
* settings
* color change
* avatar upload
* main stream
* feed.json
* websocket stream.json
* endless scrolling
* updates from websocket


## stuff to be done next

* pwa meta tags, app icon, etc
* mkdirps data dir on setup
* resize & optimize uploaded images
* invisible text input mobile
* tweet should be blocklquote
* feed sorting (wtf)
* j/k navigation
* content styles (what?)
* tags
* friends imports
* reposting & reacting (authed)
* federation / discovery / cross site follow
* reposting & reacting (federated)
* friends stream
* rich-ish editor (markdown)
* deployability
* imports from xml-feeds and such
* sanitize input links
* fix db on url change?
* edit posts
* global drag/drop
* bookmarklet / browser extension

# done

* embeds from feed ✓
* autoupdate (git pull && restart?) ✓
* permalinks / post.json ✓
* (default) avatar is broken when coming from websocket ✓
* single post page ✓

const express = require('express'),
    path = require('path'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    { GET_routers, POST_routers } = require('./router/router'),
    port = 8888;

const app = express();

app.listen(port, () => console.log(`启动服务,端口: ${port}`));
app.use(express.static(path.join(__dirname, 'image')));
//解析 body，cookie
app.use(bodyParser.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));

app.all('*', function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Content-Type', 'application/json;charset=utf-8');
    next();
});
// 启动路由监听
for (let key in GET_routers) {
    app.get(key, GET_routers[key]);
}
for (let key in POST_routers) {
    app.post(key, POST_routers[key]);
}

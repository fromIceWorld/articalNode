// 查询
// 更新
// 删除

const { ObjectId } = require('mongodb');
// 增加
const db = require('../dbhandle/dbhandler'),
    jwt = require('jsonwebtoken'),
    fs = require('fs'),
    path = require('path'),
    formidable = require('formidable'),
    filters = require('../auxiliaryFns/filters'),
    fileHTTP = 'http://192.168.1.2:8888',
    //post 请求
    POST_routers = {
        // 登录
        '/login': (req, res, next) => {
            const user = req.body;
            db.login(user, res, 'suger', 'userList');
        },
        // 发布信息
        '/release': (req, res, next) => {
            db.release(req, res, 'suger', 'articalList');
        },
        // 评论
        '/reply': (req, res, next) => {
            db.reply(req, res, 'suger', 'articalComment');
        },

        '/uploadImg': (req, res, next) => {
            res.writeHeader('200');
            const form = new formidable.IncomingForm(),
                fileUrl = [],
                targetDir = path.join(__dirname, './image');
            form.parse(req, (err, fields, files) => {
                if (err) {
                    next(err);
                    return;
                }
                const keys = Object.keys(files);
                keys.forEach((file) => {
                    const { path: filePath, name: fileName } = files[file],
                        type = fileName.substring(fileName.lastIndexOf('.')),
                        targetName =
                            filters.currentDate() +
                            Math.floor(Math.random(0, 1) * 1000) +
                            type,
                        targetFile = path.join(targetDir, targetName);
                    fs.renameSync(filePath, targetFile);
                    fileUrl.push(fileHTTP + '/image' + '/' + targetName);
                });
                const addData = { content: fields.content, images: fileUrl };
                db.insert(addData, res, 'suger', 'articalList');
            });
        },
    },
    //get 请求
    GET_routers = {
        // 首页列表
        '/index': function (req, res) {
            res.writeHeader('200');
            const userId = jwt.verify(req.cookies.token, 'userpwd').id;
            db.getArtical({}, res, 'suger', 'articalList', userId);
        },
        // 根据评论ID查询评论
        '/comment': function (req, res) {
            const userId = jwt.verify(req.cookies.token, 'userpwd').id;
            res.writeHeader('200');
            const params = {
                toArtical: ObjectId(req.query.articalId),
            };
            db.getComment(params, res, 'suger', 'articalComment', userId);
        },
        // 个人记录
        '/records': function (req, res) {
            const decodeToken = jwt.verify(req.cookies.token, 'userpwd'),
                params = {
                    userId: decodeToken.id,
                };
            res.writeHeader('200');
            db.getArtical(params, res, 'suger', 'articalList');
        },
        // 图片
        '/image/*': function (req, res) {
            let parse = /image\/([^\/]*.(jpg|gif|png))$/g.exec(req.url);
            res.writeHeader('200');
            let imgStream = fs.createReadStream(parse[0]);
            let content = [];
            imgStream.on('data', function (chunk) {
                content.push(chunk);
            });
            imgStream.on('end', function (chunk) {
                let finish = Buffer.concat(content);
                res.write(finish);
                res.end();
            });
        },
    };

module.exports = { GET_routers, POST_routers };

const { ObjectId } = require('mongodb');

const MongoClient = require('mongodb').MongoClient,
    jwt = require('jsonwebtoken'),
    url = 'mongodb://127.0.0.1:27017';
// 根据用户id查询 用户名称，用户头像
function getUser(conditions, res, respond2) {
    MongoClient.connect(
        url,
        { useUnifiedTopology: true },
        function (err, client) {
            if (err) throw err;
            var dbase = client.db('suger');
            dbase
                .collection('userList')
                .find({
                    $or: conditions,
                })
                .toArray(function (err, users) {
                    if (err) throw err;
                    client.close();
                    const params = {
                            code: 200,
                            data: '',
                        },
                        userMap = new Map();
                    users.map((user) =>
                        userMap.set(String(user._id), {
                            aliasName: user.aliasName,
                            portrait: user.portrait,
                        })
                    );
                    function addUser(target) {
                        let type = Object.prototype.toString.call(target);

                        if (type == '[object Object]') {
                            if (target.userId) {
                                Object.assign(
                                    target,
                                    userMap.get(target.userId)
                                );
                            }
                            target.children &&
                                target.children.length &&
                                addUser(target.children);
                        } else if ((type = '[object Array]')) {
                            target.map((child) => {
                                if (child.userId) {
                                    Object.assign(
                                        child,
                                        userMap.get(child.userId)
                                    );
                                }
                                child.children &&
                                    child.children.length &&
                                    addUser(child.children);
                            });
                        }
                    }
                    addUser(respond2);

                    params.data = respond2;
                    res.write(JSON.stringify(params));
                    res.end();
                });
        }
    );
}
// 增加空白评论
function addEmptyComments(res, _id) {
    MongoClient.connect(
        url,
        { useUnifiedTopology: true },
        function (err, client) {
            if (err) throw err;
            var addData = {
                    _id,
                    children: [],
                },
                dbase = client.db('suger');
            dbase
                .collection('articalComment')
                .insertOne(addData)
                .then((back) => {
                    const params = {
                        code: 200,
                        data: '插入成功',
                    };
                    client.close();
                    res.json(params);
                });
        }
    );
}
// 根据文章获取评论及评论人名称头像,👍，子评论的数量及前n条，子评论及子评论人名称头像,👍
function getComment(conditions, res, databaseName, sheet, userId) {
    MongoClient.connect(
        url,
        { useUnifiedTopology: true },
        function (err, client) {
            if (err) throw err;
            var dbase = client.db(databaseName);
            dbase
                .collection(sheet)
                .aggregate([
                    {
                        $match: conditions,
                    },
                    {
                        $lookup: {
                            from: 'userList',
                            localField: 'author',
                            foreignField: '_id',
                            as: 'user',
                        },
                    },
                    {
                        $lookup: {
                            from: 'likeCount',
                            localField: 'likeId',
                            foreignField: '_id',
                            as: 'likedList',
                        },
                    },

                    {
                        $unwind: {
                            path: '$user',
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: '$likedList',
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $lookup: {
                            from: 'articalComment',
                            localField: '_id',
                            foreignField: 'toComment',
                            as: 'comments',
                        },
                    },
                    {
                        $lookup: {
                            from: 'userList',
                            localField: 'comments.author',
                            foreignField: '_id',
                            as: '[comments]',
                        },
                    },
                    {
                        $project: {
                            time: 1,
                            content: 1,
                            comments: 1,
                            any: 1,
                            'user.aliasName': 1,
                            'user._id': 1,
                            'user.avatar': 1,
                            'likedList.like': 1,
                            'likedList.dislike': 1,
                            commentReplyLiked: 1,
                            'commentReplyUser.user._id': 1,
                            'commentReplyUser.user.avatar': 1,
                        },
                    },
                ])
                .toArray()
                .then((result) => {
                    result.map((item) => {
                        item.likeCount = item.likedList.like.length;
                        item.dislikeCount = item.likedList.dislike.length;
                        item.liked = 0;
                        if (item.likedList.like.includes(userId)) {
                            item.liked = 1;
                        } else if (item.likedList.dislike.includes(userId)) {
                            item.liked = -1;
                        }
                        delete item.likedList;
                    });
                    const respond = {
                        code: 200,
                        data: result,
                    };
                    client.close();
                    res.write(JSON.stringify(respond));
                    res.end();
                })
                .catch((err) => {
                    console.log(err);
                });
        }
    );
}
// 根据 点赞，踩 的列表 获取个数及请求人是否点赞/踩

// 获取文章列表
function getArtical(conditions, res, databaseName, sheet, userId) {
    MongoClient.connect(
        url,
        { useUnifiedTopology: true },
        function (err, client) {
            if (err) throw err;
            var dbase = client.db(databaseName);
            dbase
                .collection(sheet)
                .aggregate([
                    {
                        $lookup: {
                            from: 'userList',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'user',
                        },
                    },
                    {
                        $lookup: {
                            from: 'likeCount',
                            localField: 'likeId',
                            foreignField: '_id',
                            as: 'likedList',
                        },
                    },
                    {
                        $lookup: {
                            from: 'articalComment',
                            localField: 'commentId',
                            foreignField: 'toArtical',
                            as: 'comments',
                        },
                    },
                    {
                        $unwind: {
                            path: '$user',
                        },
                    },
                    {
                        $unwind: {
                            path: '$likedList',
                        },
                    },
                    {
                        $project: {
                            time: 1,
                            content: 1,
                            'user.aliasName': 1,
                            'user._id': 1,
                            'user.avatar': 1,
                            'user.description': 1,
                            'likedList.like': 1,
                            'likedList.dislike': 1,
                            commentTotal: {
                                $size: '$comments',
                            },
                        },
                    },
                ])
                .toArray()
                .then((articalList) => {
                    articalList.map((item) => {
                        item.likeCount = item.likedList.like.length;
                        item.dislikeCount = item.likedList.dislike.length;
                        item.liked = 0;
                        if (item.likedList.like.includes(userId)) {
                            item.liked = 1;
                        } else if (item.likedList.dislike.includes(userId)) {
                            item.liked = -1;
                        }
                        delete item.likedList;
                    });
                    const respond = {
                        code: 200,
                        data: articalList,
                    };
                    client.close();
                    res.write(JSON.stringify(respond));
                    res.end();
                })
                .catch((err) => {
                    console.log(err);
                });
        }
    );
}
function release(req, res, databaseName, sheet) {
    MongoClient.connect(
        url,
        { useUnifiedTopology: true },
        function (err, client) {
            if (err) throw err;
            var addData = req.body,
                decodeToken = jwt.verify(req.cookies.token, 'userpwd'),
                dbase = client.db(databaseName);
            const _id = new ObjectId(),
                user = {
                    commentId: _id,
                    userId: decodeToken.id,
                };
            Object.assign(addData, user);
            dbase
                .collection(sheet)
                .insertOne(addData)
                .then((back) => {
                    addEmptyComments(res, _id);
                });
        }
    );
}
function login(user, res, databaseName, sheet) {
    MongoClient.connect(
        url,
        { useUnifiedTopology: true },
        function (err, client) {
            if (err) throw err;
            var dbase = client.db(databaseName);
            dbase
                .collection(sheet)
                .find(user)
                .toArray(function (err, respond) {
                    if (err) throw err;
                    let params = {};
                    if (respond.length) {
                        const { _id: id, userName, avatar } = respond[0];
                        const token = jwt.sign(
                            {
                                id,
                                userName,
                            },
                            'userpwd',
                            { expiresIn: 3600 * 24 * 3 }
                        );
                        res.cookie('token', token, {
                            maxAge: 1000 * 60 * 60 * 24 * 3,
                            httpOnly: true,
                        });
                        params = {
                            code: 200,
                            data: {
                                aliasName,
                                avatar,
                                id,
                            },
                            message: 'ok',
                        };
                    } else {
                        params = {
                            code: '403',
                            data: null,
                            message: 'token无效',
                        };
                    }
                    client.close();
                    res.json(params);
                });
        }
    );
}
//评论
function reply(req, res, databaseName, sheet) {
    MongoClient.connect(
        url,
        { useUnifiedTopology: true },
        function (err, client) {
            if (err) throw err;
            var body = req.body.params,
                decodeToken = jwt.verify(req.cookies.token, 'userpwd'),
                dbase = client.db(databaseName);
            let conditions,
                push,
                addData = {
                    _id: new ObjectId(),
                    content: body.content,
                    userId: decodeToken.id,
                    replyTo: body.replyTo ? body.replyTo : '', //回复对象
                    children: [],
                };
            // 回复评论
            if (body.replyCommentId) {
                conditions = {
                    'children._id': ObjectId(body.replyCommentId),
                };
                push = { 'children.$.children': addData };
            } else {
                conditions = {
                    _id: ObjectId(body.replyArticalId),
                };
                push = {
                    children: addData,
                };
            }

            dbase
                .collection(sheet)
                .updateOne(conditions, { $push: push }, null, function (back) {
                    const params = {
                        code: 200,
                        data: '插入成功',
                    };
                    client.close();
                    res.json(params);
                });
        }
    );
}
module.exports = { getComment, getArtical, release, login, reply };

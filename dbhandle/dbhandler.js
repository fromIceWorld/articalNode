const { ObjectId } = require('mongodb');
const { transDBTime } = require('../auxiliaryFns/filters');
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
                            as: 'commentReply',
                        },
                    },
                    {
                        $lookup: {
                            from: 'userList',
                            localField: 'commentReply.author',
                            foreignField: '_id',
                            as: '[commentReply]',
                        },
                    },
                    {
                        $project: {
                            time: 1,
                            content: 1,
                            'commentReply.content': 1,
                            'commentReply.likeId': 1,
                            'commentReply.author': 1,
                            'commentReply.time': 1,
                            'commentReply._id': 1,
                            'commentReply.replyTo': 1,
                            any: 1,
                            'user.aliasName': 1,
                            'user._id': 1,
                            'user.avatar': 1,
                            'likedList._id': 1,
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
                    // 根据二级评论的user，like，查询用户信息和点赞信息
                    const userMap = new Map(),
                        likeMap = new Map();
                    result.map((item) => {
                        item.time = transDBTime(item.time);
                        item.likeId = item.likedList._id;
                        item.likeCount = item.likedList.like.length;
                        item.dislikeCount = item.likedList.dislike.length;
                        item.liked = 0;
                        if (item.likedList.like.includes(userId)) {
                            item.liked = 1;
                        } else if (item.likedList.dislike.includes(userId)) {
                            item.liked = -1;
                        }
                        delete item.likedList;
                        // 收集评论user,回复对象，like
                        item.commentReply.map((comment) => {
                            if (!userMap.has(comment.author)) {
                                userMap.set(comment.author, '');
                            }
                            if (
                                comment.replyTo &&
                                !userMap.has(comment.replyTo)
                            ) {
                                userMap.set(comment.replyTo, '');
                            }
                            // 收集like
                            likeMap.set(comment.likeId, '');
                        });
                    });
                    const queryUser = [],
                        queryLike = [];
                    for (let i of userMap.keys()) {
                        queryUser.push({ _id: i });
                    }
                    for (let i of likeMap.keys()) {
                        queryLike.push({ _id: i });
                    }
                    // 根据 userMap/likeMap 查询数据库
                    Promise.all([
                        dbase
                            .collection('userList')
                            .aggregate([
                                {
                                    $match: { $or: queryUser },
                                },
                                {
                                    $project: {
                                        aliasName: 1,
                                        avatar: 1,
                                        _id: 1,
                                    },
                                },
                            ])
                            .toArray(),
                        dbase
                            .collection('likeCount')
                            .aggregate([
                                {
                                    $match: { $or: queryLike },
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        dislike: 1,
                                        like: 1,
                                    },
                                },
                            ])
                            .toArray(),
                    ]).then((ret) => {
                        const [userList, likeList] = ret,
                            objByUser = new Map(),
                            objBylike = new Map();
                        userList.map((user) => {
                            objByUser.set(user._id.toString(), user);
                        });
                        likeList.map((like) => {
                            objBylike.set(like._id.toString(), like);
                        });
                        result.map((item) => {
                            item.commentReply.map((comment) => {
                                comment.user = objByUser.get(
                                    comment.author.toString()
                                );
                                comment.reply =
                                    comment.replyTo &&
                                    objByUser.get(comment.replyTo.toString());
                                comment.likeList = objBylike.get(
                                    comment.likeId.toString()
                                );
                                // 二级评论转换
                                comment.time = transDBTime(comment.time);
                                comment.likeCount =
                                    comment.likeList.like.length;
                                comment.dislikeCount =
                                    comment.likeList.dislike.length;
                                comment.liked = 0;
                                if (comment.likeList.like.includes(userId)) {
                                    comment.liked = 1;
                                } else if (
                                    comment.likeList.dislike.includes(userId)
                                ) {
                                    comment.liked = -1;
                                }
                                delete comment.likeList;
                            });
                        });
                        const respond = {
                            code: 200,
                            data: result,
                        };
                        client.close();
                        res.write(JSON.stringify(respond));
                        res.end();
                    });
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
                            'likedList._id': 1,
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
                        item.time = transDBTime(item.time);
                        item.likeId = item.likedList._id;
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
// 发布文章
function release(req, res, databaseName, sheet) {
    MongoClient.connect(
        url,
        { useUnifiedTopology: true },
        function (err, client) {
            if (err) throw err;
            var addData = req.body,
                userId = jwt.verify(req.cookies.token, 'userpwd').id,
                dbase = client.db(databaseName);
            const likeId = new ObjectId(),
                content = {
                    content: addData.content,
                    userId: new ObjectId(userId),
                    likeId,
                    commentId: '',
                    time: new Date(),
                };
            dbase
                .collection(sheet)
                .insertOne(content, function (err, addArticalResult) {
                    dbase
                        .collection('likeCount')
                        .insertOne(
                            { _id: likeId, like: [], dislike: [] },
                            function (err, addLiked) {
                                const params = {
                                    code: 200,
                                    data: '插入成功',
                                };
                                client.close();
                                res.json(params);
                            }
                        );
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
                        const {
                            _id: id,
                            userName,
                            aliasName,
                            avatar,
                        } = respond[0];
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
//评论 文章/评论
function addComment(req, res, databaseName, sheet) {
    MongoClient.connect(
        url,
        { useUnifiedTopology: true },
        function (err, client) {
            // 对文章进行评论，需要添加新的数据到likeCount
            if (err) throw err;
            var body = req.body.params,
                decodeToken = jwt.verify(req.cookies.token, 'userpwd'),
                dbase = client.db(databaseName);
            let likeId = new ObjectId(),
                addComment = {
                    likeId,
                    time: new Date(),
                    content: body.content,
                    author: new ObjectId(decodeToken.id),
                    replyTo: body.replyTo ? new ObjectId(body.replyTo) : '', //回复对象
                    toArtical: new ObjectId(body.toArtical), //回复所属文章
                    toComment: body.toComment
                        ? new ObjectId(body.toComment)
                        : '', //回复评论
                };
            // 插入评论，插入评论的like属性
            dbase.collection(sheet).insertOne(addComment, function (back) {
                // 插入评论对应的like
                dbase
                    .collection('likeCount')
                    .insertOne(
                        { _id: likeId, like: [], dislike: [] },
                        function (result) {
                            const params = {
                                code: 200,
                                data: '插入成功',
                            };
                            client.close();
                            res.json(params);
                        }
                    );
            });
        }
    );
}
// 点赞
function liked(req, res, databaseName, sheet) {
    const body = req.body.params,
        userId = jwt.verify(req.cookies.token, 'userpwd').id;
    const { _id, from, to } = body,
        params = { _id: ObjectId(_id) };

    MongoClient.connect(
        url,
        { useUnifiedTopology: true },
        function (err, client) {
            if (err) return;
            const dataList = client.db(databaseName).collection(sheet);
            dataList.findOne(params, function (err, result) {
                if (err) return;
                const { like, dislike } = result;
                if (from == 1 && to == 1) {
                    like.splice(like.indexOf(userId), 1);
                } else if (from == -1 && to == -1) {
                    dislike.splice(dislike.indexOf(userId), 1);
                } else if (from == -1 && to == 1) {
                    dislike.splice(dislike.indexOf(userId), 1);
                    like.push(userId);
                } else if (from == 1 && to == -1) {
                    like.splice(like.indexOf(userId), 1);
                    dislike.push(userId);
                } else if (from == 0) {
                    if (to == 1) {
                        like.push(userId);
                    } else {
                        dislike.push(userId);
                    }
                }
                dataList.updateOne(
                    params,
                    { $set: { like: like, dislike: dislike } },
                    function (err, result) {
                        if (err) {
                            return;
                        } else {
                            const params = {
                                code: 200,
                                data: '修改成功',
                            };
                            client.close();
                            res.json(params);
                        }
                    }
                );
            });
        }
    );
}
module.exports = { getComment, getArtical, release, login, addComment, liked };

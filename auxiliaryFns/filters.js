// 当前时间
function currentDate() {
    const date = new Date(),
        outDate =
            date.toLocaleDateString().replace(/\//g, '-') +
            '  ' +
            date.toTimeString().slice(0, 8);
    return outDate;
}
function transDBTime(DBtime) {
    outDate =
        DBtime.toLocaleDateString().replace(/\//g, '-') +
        '  ' +
        DBtime.toTimeString().slice(0, 8);
    return outDate;
}
module.exports = { currentDate, transDBTime };

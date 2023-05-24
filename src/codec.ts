
/*
url: https://www.npmjs.com/package/pomelo-protobuf?activeTab=code
*/

/**
 * 把输入的 数值或字符串 统一转换为整数
 */
export function any2Int(input: any) {
    return typeof input == "number" ? Math.floor(input) : parseInt(input.toString());
}

/**
 * 编码一个 uInt32 整数，返回一个数组，低位在索引0处
 */
export function encodeUInt32(num: number | string) {

    let n = any2Int(num);

    if (isNaN(n) || n < 0) {
        return undefined;
    }

    let ret: number[] = [];
    while (n > 0x7f) {
        ret.push(0x80 | (n & 0x7f));
        n = n >> 7;
    }
    ret.push(n);

    return ret;
}

/**
 * 编码一个 sInt32 整数，返回一个数组，低位在索引0处，索引0的最低位为符号位
 */
export function encodeSInt32(num: number | string) {
    let n = any2Int(num);

    if (isNaN(n)) {
        return undefined;
    }

    // 取索引0的最低位为符号位
    n = n < 0
        ? (Math.abs(n) << 1) - 1
        : (n << 1);

    return encodeUInt32(n);
}

export function decodeUInt32(bytes: (number | string)[]) {
    var n = 0;

    for (var i = 0; i < bytes.length; i++) {
        var m = any2Int(bytes[i]);
        n = n | ((m & 0x7f) << (7 * i));

        if (m < 128) {
            return n;
        }
    }

    return n;
};


export function decodeSInt32(bytes: (number | string)[]) {
    let n = decodeUInt32(bytes);
    let flag = n & 1;

    n = flag == 1
        ? ((n + 1) >> 1) * -1
        : n >> 1;

    return n;
};
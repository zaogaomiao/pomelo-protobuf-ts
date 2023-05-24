const SimpleType = ["uInt32", "sInt32", "int32", "uInt64", "sInt64", "float", "double",];

export function isSimpleType(type_name: string) {
    return SimpleType.includes(type_name);
};

function isObject(obj: any): obj is Object {
    return typeof obj == "object" && obj !== null;
}

export function isEqual(obj0: any, obj1: any) {
    if (!isObject(obj0) || !isObject(obj1)) {
        return obj0 === obj1;
    }

    const key0 = Object.keys(obj0);
    const key1 = Object.keys(obj1);

    if (key0.length != key1.length) {
        return false;
    }

    for (const key in key0) {
        const m = obj0[key];
        const n = obj1[key];

        const x = isEqual(m,n);
        if(!x) return false;
    }

    return true;
};
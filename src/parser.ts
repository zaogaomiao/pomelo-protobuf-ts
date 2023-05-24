

export const ProtoTypeNode_Messages = Symbol("messages");
export const ProtoTypeNode_Tags = Symbol("tags");

export type ProtoTags = { [key: number]: string }
export type ProtoOption = {
    option: 'required' | 'optional' | 'repeated'
    type: string
    tag: number
}
export type ProtoTypeTree = { [key: string]: ProtoTypeNode }

export type ProtoTypeNode = {
    [ProtoTypeNode_Messages]: ProtoTypeTree
    [ProtoTypeNode_Tags]: ProtoTags
    [key: string]: ProtoOption
}


/**
 * parse the original protos, give the paresed result can be used by protobuf encode/decode.
 */
export function parse(protos: any) {
    const maps: ProtoTypeTree = {};
    for (var key in protos) {
        maps[key] = parseObject(protos[key]);
    }
    return maps;
};

/*
 * [parse a single protos, return a object represent the result. The method can be invocked recursively.]
 * @param  {[Object]} obj The origin proto need to parse.
 * @return {[Object]} The parsed result, a js object.
 */
function parseObject(obj: any): ProtoTypeNode {
    const proto_tree: { [key: string]: ProtoOption } = {}
    const nestProtos: ProtoTypeTree = {};
    const tags: ProtoTags = {};

    for (const name in obj) {
        var tag: number = obj[name];
        var params = name.split(' ');

        switch (params[0]) {
            case 'message':
                if (params.length !== 2) {
                    continue;
                }
                nestProtos[params[1]] = parseObject(tag);
                continue;
            case 'required':
            case 'optional':
            case 'repeated': {
                //params length should be 3 and tag can't be duplicated
                if (params.length !== 3 || !!tags[tag]) {
                    continue;
                }
                proto_tree[params[2]] = {
                    option: params[0],
                    type: params[1],
                    tag: tag
                };
                tags[tag] = params[2];
            }
        }
    }

    const proto: ProtoTypeNode = Object.assign(
        {
            [ProtoTypeNode_Messages]: nestProtos,
            [ProtoTypeNode_Tags]: tags
        },
        proto_tree
    );
    return proto;
}
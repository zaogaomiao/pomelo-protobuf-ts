import { encodeUInt32, encodeSInt32, any2Int } from './codec';
import { TYPES } from './constant';
import { ProtoOption, ProtoTypeNode, ProtoTypeNode_Messages, ProtoTypeTree } from './parser';
import * as util from './util';

export class Encoder {
    constructor(
        public readonly protos: ProtoTypeTree
    ) { }

    encode(route: string, msg: any): Buffer | undefined {

        try {
            if (!route || !msg) {
                this.throwError`Route or msg can not be null! route : ${route}, msg ${msg}`;
            }

            //Get protos from protos map use the route as key
            const sub_proto = this.protos[route];

            //Check msg
            this.checkMsg(msg, sub_proto);

            /** 长度估算 */
            const length = Buffer.byteLength(JSON.stringify(msg)) * 2; // 应当要有优化方法
            // Set the length of the buffer 2 times bigger to prevent overflow

            /** 写入缓存 */
            const buffer = Buffer.allocUnsafe(length);

            let offset = 0;

            if (sub_proto) {
                offset = this.encodeMsg(buffer, offset, sub_proto, msg);
                if (offset > 0) {
                    return buffer.subarray(0, offset); // 在原空间上直接生成同源的一个子数据
                }
            }

            return undefined;
        } catch (error) {
            console.warn(error);
            return undefined;
        }


    }

    private checkMsg(msg: any, p: ProtoTypeNode): boolean {

        if (!p || !msg) {
            this.throwError`no protos or msg exist! msg : ${msg}, protos : ${p}`;
        }

        for (const name in p) {
            const sub_po = p[name];
            const sub_msg = msg[name];

            //All required element must exist
            switch (sub_po.option) {
                case 'required':
                    if (typeof sub_msg === 'undefined') {
                        this.throwError`no property exist for required! name: ${name}, proto: ${sub_po}, msg: ${msg}`;
                    }

                case 'optional':
                    if (typeof sub_msg !== 'undefined') {
                        const ptype = p[ProtoTypeNode_Messages][sub_po.type]
                            || this.protos['message ' + sub_po.type];
                        if (ptype) {
                            this.checkMsg(sub_msg, ptype)
                            //console.warn('inner proto error! name: %j, proto: %j, msg: %j', name, sub_p, msg);
                        }
                    }
                    break;

                case 'repeated':
                    //Check nest message in repeated elements
                    const ptype = p[ProtoTypeNode_Messages][sub_po.type]
                        || this.protos['message ' + sub_po.type];
                    if (!Array.isArray(sub_msg)) {
                        this.throwError`should be array! name: ${name}, proto: ${sub_po}, msg: ${msg}`;
                    }
                    if (sub_msg && ptype) {
                        for (var i = 0; i < sub_msg.length; i++) {
                            this.checkMsg(sub_msg[i], ptype);
                        }
                    }
                    break;
            }
        }

        return true;
    }

    /**
     * 抛出一个异常，其输入为一个模版语法，输入的对象转化为 JSON 文本
     * @param slist 
     * @param vlist 
     */
    private throwError(slist: TemplateStringsArray, ...vlist: any[]) {
        throw vlist
            .map(
                (v, i) => slist[i] + (typeof v == "string" ? v : JSON.stringify(v))
            )
            .concat(slist.slice(-1))
            .join("")
    }

    private encodeMsg(buffer: Buffer, offset: number, p: ProtoTypeNode, msg: any): number {
        for (const name in msg) {
            if (name in p) {
                const sub_p = p[name];

                switch (sub_p.option) {
                    case 'required':
                    case 'optional':
                        offset = this.writeBytes(buffer, offset, this.encodeTag(sub_p.type, sub_p.tag));
                        offset = this.encodeProp(msg[name], sub_p.type, offset, buffer, p);
                        break;

                    case 'repeated':
                        const arr = msg[name];
                        if (arr && Array.isArray(arr) && arr.length > 0) {
                            offset = this.encodeArray(arr, sub_p, offset, buffer, p);
                        }
                        break;
                }
            }
        }

        return offset;
    }

    private encodeProp(value: any, type: string, offset: number, buffer: Buffer, p?: ProtoTypeNode): any {

        let length = 0;

        switch (type) {
            case 'uInt32':
                offset = this.writeBytes(
                    buffer,
                    offset,
                    encodeUInt32(any2Int(value))
                );
                break;

            case 'int32':
            case 'sInt32':
                offset = this.writeBytes(
                    buffer,
                    offset,
                    encodeSInt32(any2Int(value))
                );
                break;

            case 'float':
                buffer.writeFloatLE(value, offset);
                offset += 4;
                break;

            case 'double':
                buffer.writeDoubleLE(value, offset);
                offset += 8;
                break;

            case 'string':
                length = Buffer.byteLength(value);
                offset = this.writeBytes(buffer, offset, encodeUInt32(length));
                buffer.write(value, offset, length);
                offset += length;
                break;

            default:
                const message = (p && p[ProtoTypeNode_Messages][type])
                    || this.protos['message ' + type];
                if (message) {
                    //Use a tmp buffer to build an internal msg
                    const tmpBuffer = Buffer.allocUnsafe(Buffer.byteLength(JSON.stringify(value)) * 2);
                    length = 0;

                    length = this.encodeMsg(tmpBuffer, length, message, value);
                    //Encode length
                    offset = this.writeBytes(buffer, offset, encodeUInt32(length));
                    //contact the object
                    tmpBuffer.copy(buffer, offset, 0, length);

                    offset += length;
                }
                break;
        }

        return offset;
    }

    private encodeArray(arr: any[], proto_option: ProtoOption, offset: number, buffer: Buffer,
        proto: ProtoTypeNode): number {

        const { type, tag } = proto_option;
        const tag_bytes = this.encodeTag(type, tag);

        if (util.isSimpleType(type)) {
            // tag
            offset = this.writeBytes(buffer, offset, tag_bytes);
            // length
            offset = this.writeBytes(buffer, offset, encodeUInt32(arr.length));
            // items
            arr.forEach(v => {
                offset = this.encodeProp(v, type, offset, buffer);
            });
            // for (let i = 0; i < arr.length; i++) {
            //     offset = this.encodeProp(arr[i], type, offset, buffer);
            // }
        } else {
            arr.forEach(v => {
                offset = this.writeBytes(buffer, offset, tag_bytes);
                offset = this.encodeProp(v, type, offset, buffer, proto);
            });
            // for (let i = 0; i < arr.length; i++) {
            //     offset = this.writeBytes(buffer, offset, this.encodeTag(type, tag));
            //     offset = this.encodeProp(arr[i], type, offset, buffer, proto);
            // }
        }

        return offset;
    }

    private writeBytes(buffer: Buffer, offset: number, bytes?: number[]): number {

        if (!bytes) return offset; // 没写入什么

        for (var i = 0; i < bytes.length; i++) {
            buffer.writeUInt8(bytes[i], offset + i);
        }

        return offset + bytes.length;
    }

    private encodeTag(type: string, tag: number) {
        return encodeUInt32(
            (tag << 3)
            | (type in TYPES ? TYPES[type] : 2)
        )
    }
}




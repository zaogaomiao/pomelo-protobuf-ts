import { Encoder } from './encoder';
import { Decoder } from './decoder';
import { parse as parseProtos, ProtoTypeTree } from './parser';

interface ProtobufOption {
    encodeProtos: ProtoTypeTree
    decodeProtos: ProtoTypeTree
}

export class Protobuf {

    private encoder: Encoder
    private decoder: Decoder

    constructor(option: ProtobufOption) {
        this.encoder = new Encoder(option.encodeProtos);
        this.decoder = new Decoder(option.decodeProtos);
    }

    /**
     * encode the given message, return a Buffer represent the message encoded by protobuf
     * @param key 
     * @param msg 
     * @returns 
     */
    encode(key: string, msg: any) {
        return this.encoder.encode(key, msg);
    }

    encode2Bytes(key: string, msg: any) {
        const buffer = this.encode(key, msg);

        if (!buffer || !buffer.length) {
            console.warn('encode msg failed! key : %j, msg : %j', key, msg);
            return undefined;
        }

        const bytes = new Uint8Array(buffer.length);
        buffer.copy(bytes, 0, 0, buffer.length);
        return bytes;
    }

    encodeStr(key: string, msg: any, code: BufferEncoding = "base64") {
        const buffer = this.encode(key, msg);
        return buffer ? buffer.toString(code) : "";
    }

    decode(route: string, buf: Buffer) {
        return this.decoder.decode(route, buf);
    }

    decodeStr(key: string, input: string, code: BufferEncoding = "base64") {
        const buffer = Buffer.from(input, code);
        return this.decode(key, buffer);
    }

    parse(json: any) {
        return parseProtos(json);
    }
}


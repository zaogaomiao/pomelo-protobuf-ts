import * as codec from './codec';
import { ProtoTypeNode, ProtoTypeTree, ProtoTypeNode_Messages, ProtoTypeNode_Tags } from './parser';
import { isSimpleType } from './util';

interface DataPacket {
	buffer: Buffer
	offset: number
}

export class Decoder {

	constructor(
		public readonly protos: ProtoTypeTree
	) { }

	decode(route: string, buf: Buffer) {
		const p = this.protos[route];
		if (p) {
			return this.decodeMsg(
				{ buffer: buf, offset: 0 },
				{},
				p,
				buf.length
			);
		}
		return null;
	}

	private decodeMsg(data: DataPacket, msg: any, p: ProtoTypeNode, length: number) {

		while (data.offset < length) {
			//? var type = head.type;
			const { tag } = this.getHead(data);
			const name = p[ProtoTypeNode_Tags][tag];

			if (name in p) {
				const { option, type } = p[name];
				switch (option) {
					case 'optional':
					case 'required':
						msg[name] = this.decodeProp(data, type, p);
						break;
					case 'repeated':
						if (!msg[name]) {
							msg[name] = [];
						}
						this.decodeArray(data, msg[name], type, p);
						break;
				}
			}
		}

		return msg;
	}

	private isFinish(data: DataPacket, msg: any, p: ProtoTypeNode) {
		return (!p[ProtoTypeNode_Tags][this.getHead(data, true).tag]);
	}

	/**
	 * 获取头标志
	 * @param data 数据包
	 * @param isPeek 是否为试探性读取，区别在于读取后是否移位，默认为`false`
	 * @returns 
	 */
	private getHead(data: DataPacket, isPeek: boolean = false) {

		const tag = codec.decodeUInt32(this.getBytes(data, isPeek));

		return {
			type: tag & 0x7,
			tag: tag >> 3
		};
	}

	private decodeProp(data: DataPacket, type: string, p?: ProtoTypeNode) {

		const { buffer, offset } = data;

		switch (type) {
			case 'uInt32':
				return codec.decodeUInt32(this.getBytes(data));

			case 'int32':
			case 'sInt32':
				return codec.decodeSInt32(this.getBytes(data));

			case 'float':
				let f = buffer.readFloatLE(offset);
				data.offset += 4;
				return f;

			case 'double':
				let d = buffer.readDoubleLE(offset);
				data.offset += 8;
				return d;

			case 'string':
				var length = codec.decodeUInt32(this.getBytes(data));
				var str = buffer.toString('utf8', offset, offset + length);
				data.offset += length;
				return str;

			default:
				var message = p && (
					p[ProtoTypeNode_Messages][type]
					|| this.protos['message ' + type]
				);
				if (message) {
					var length = codec.decodeUInt32(this.getBytes(data));
					var msg = {};
					this.decodeMsg(data, msg, message, offset + length);
					return msg;
				}
				break;
		}
	}

	private decodeArray(data: DataPacket, array: any[], type: string, p: ProtoTypeNode) {

		if (isSimpleType(type)) {
			const length = codec.decodeUInt32(this.getBytes(data));

			for (let i = 0; i < length; i++) {
				array.push(this.decodeProp(data, type));
			}
		} else {
			array.push(this.decodeProp(data, type, p));
		}
	}

	/** 一直获取字节直至小于 `0x80(128)` */
	private *getByteGt80(buffer: Buffer, pos: number) {
		while (pos < buffer.length) {
			let b = buffer.readUint8(pos);
			yield b;
			if (b < 0x80) return;
			pos++;
		}
	}

	/**
	 * 获取字节数据，并将偏移量累加上去
	 * @param data 数据包
	 * @param flag 是否为位读取，`true`时不累加偏移量，默认为`false`
	 * @returns 
	 */
	private getBytes(data: DataPacket, flag: boolean = false) {
		const { buffer, offset } = data;

		const ret: number[] = [...this.getByteGt80(buffer, offset)];

		if (!flag) {
			data.offset += ret.length;
		}
		return ret;
	}

	private peekBytes(data: DataPacket) {
		return this.getBytes(data, true);
	}
}

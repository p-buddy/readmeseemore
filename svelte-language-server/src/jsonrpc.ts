import type { MessageReaderOptions, MessageWriterOptions, ReadableStreamMessageReader, WriteableStreamMessageWriter, } from "vscode-jsonrpc";
import { StreamMessageReader as _StreamMessageReader, StreamMessageWriter as _StreamMessageWriter } from "../node_modules/vscode-jsonrpc/lib/node/main";
import type { Writable, Readable } from 'node:stream';

type Encoding = "ascii" | "utf-8";

export declare class StreamMessageWriterType extends WriteableStreamMessageWriter {
  constructor(writable: NodeJS.WritableStream, options?: Encoding | MessageWriterOptions);
}

export class StreamMessageReader extends _StreamMessageReader implements ReadableStreamMessageReader {
  constructor(readable: Readable, encoding?: Encoding | MessageReaderOptions) {
    super(readable, encoding);
  }
}

export class StreamMessageWriter extends _StreamMessageWriter implements WriteableStreamMessageWriter {
  constructor(writable: Writable, options?: Encoding | MessageWriterOptions) {
    super(writable, options);
  }
}
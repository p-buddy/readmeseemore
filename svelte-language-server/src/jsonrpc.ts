import type { MessageReaderOptions, MessageWriterOptions, ReadableStreamMessageReader, WriteableStreamMessageWriter, } from "vscode-jsonrpc";
import { StreamMessageReader as _StreamMessageReader, StreamMessageWriter as _StreamMessageWriter } from "../node_modules/vscode-jsonrpc/lib/node/main";
import type { Writable, Readable } from 'node:stream';

export declare class StreamMessageWriterType extends WriteableStreamMessageWriter {
  constructor(writable: NodeJS.WritableStream, options?: ("ascii" | "utf-8") | MessageWriterOptions);
}

export class StreamMessageReader extends _StreamMessageReader implements ReadableStreamMessageReader {
  constructor(readable: Readable, encoding?: ("ascii" | "utf-8") | MessageReaderOptions) {
    super(readable, encoding);
  }
}

export class StreamMessageWriter extends _StreamMessageWriter implements WriteableStreamMessageWriter {
  constructor(writable: Writable, options?: ("ascii" | "utf-8") | MessageWriterOptions) {
    super(writable, options);
  }
}
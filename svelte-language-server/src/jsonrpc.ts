import type { DataCallback, MessageReaderOptions, MessageWriterOptions, ReadableStreamMessageReader, WriteableStreamMessageWriter, Disposable } from "vscode-jsonrpc";
import { StreamMessageReader as _StreamMessageReader, StreamMessageWriter as _StreamMessageWriter } from "../node_modules/vscode-jsonrpc/lib/node/main";
import type { Writable, Readable } from 'node:stream';

type Encoding = "ascii" | "utf-8";

export class StreamMessageReader extends _StreamMessageReader implements ReadableStreamMessageReader {
  constructor(private _readable: Readable, encoding?: Encoding | MessageReaderOptions) {
    super(_readable, encoding);
  }

  public listen(callback: DataCallback): Disposable {
    const { _readable: readable } = this;
    const result = super.listen(callback);
    const onChunk = ({ buffer, byteOffset, byteLength }: Buffer) =>
      this["onData"](new Uint8Array(buffer, byteOffset, byteLength));
    readable.on('data', onChunk);
    return {
      dispose: () => {
        result.dispose();
        readable.removeListener('data', onChunk);
      }
    };
  }

  protected fireError(error: any): void {
    console.log("(LS) fireError", error);
  }
}

export class StreamMessageWriter extends _StreamMessageWriter implements WriteableStreamMessageWriter {
  constructor(writable: Writable, options?: Encoding | MessageWriterOptions) {
    super(writable, options);
  }
}
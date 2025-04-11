import type { DataCallback, MessageReaderOptions, MessageWriterOptions, ReadableStreamMessageReader, WriteableStreamMessageWriter, Disposable } from "vscode-jsonrpc";
import { StreamMessageReader as _StreamMessageReader, StreamMessageWriter as _StreamMessageWriter } from "../node_modules/vscode-jsonrpc/lib/node/main";
import type { Writable, Readable } from 'node:stream';

type Encoding = "ascii" | "utf-8";

export class StreamMessageReader extends _StreamMessageReader implements ReadableStreamMessageReader {
  constructor(private _readable: Readable, encoding?: Encoding | MessageReaderOptions) {
    super(_readable, encoding);
  }

  public listen(callback: DataCallback): Disposable {
    console.log("StreamMessageReaderlisten");
    const result = super.listen(callback);
    const onChunk = (chunk: Buffer) => {
      console.log("onChunk", chunk);
      const data = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      this["onData"](data);
    }
    this._readable.on('data', onChunk);
    return {
      dispose: () => {
        console.log("StreamMessageReader dispose");
        result.dispose();
        this._readable.removeListener('data', onChunk);
      }
    };
  }
}

export class StreamMessageWriter extends _StreamMessageWriter implements WriteableStreamMessageWriter {
  constructor(writable: Writable, options?: Encoding | MessageWriterOptions) {
    super(writable, options);
  }


}
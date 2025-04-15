import { type MessageReaderOptions, type MessageWriterOptions, ReadableStreamMessageReader, WriteableStreamMessageWriter, type Disposable } from "vscode-jsonrpc";
import type { TranscodeEncoding } from "node:buffer";

type Encoding = "ascii" | "utf-8";

interface _ReadableStream {
  onData(listener: (data: Uint8Array) => void): Disposable;
  onClose(listener: () => void): Disposable;
  onError(listener: (error: any) => void): Disposable;
  onEnd(listener: () => void): Disposable;
}

interface _WritableStream {
  onClose(listener: () => void): Disposable;
  onError(listener: (error: any) => void): Disposable;
  onEnd(listener: () => void): Disposable;
  write(data: Uint8Array): Promise<void>;
  write(data: string, encoding: Encoding): Promise<void>;
  end(): void;
}

const disosable = (fn: () => void) => ({ dispose: fn })

const decoder = new TextDecoder();

// https://github.com/microsoft/vscode-languageserver-node/blob/df05883f34b39255d40d68cef55caf2e93cff35f/jsonrpc/src/node/ril.ts#L48
class ReadableStreamWrapper implements _ReadableStream {

  constructor(private stream: NodeJS.ReadableStream) {
  }

  public onClose(listener: () => void): Disposable {
    this.stream.on('close', listener);
    return disosable(() => this.stream.off('close', listener));
  }

  public onError(listener: (error: any) => void): Disposable {
    this.stream.on('error', listener);
    return disosable(() => this.stream.off('error', listener));
  }

  public onEnd(listener: () => void): Disposable {
    this.stream.on('end', listener);
    return disosable(() => this.stream.off('end', listener));
  }

  public onData(listener: (data: Uint8Array) => void): Disposable {
    this.stream.on('data', listener);
    return disosable(() => this.stream.off('data', listener));
  }
}

//https://github.com/microsoft/vscode-languageserver-node/blob/df05883f34b39255d40d68cef55caf2e93cff35f/jsonrpc/src/node/ril.ts#L74
class WritableStreamWrapper implements _WritableStream {

  constructor(private stream: NodeJS.WritableStream) {
  }

  public onClose(listener: () => void): Disposable {
    this.stream.on('close', listener);
    return disosable(() => this.stream.off('close', listener));
  }

  public onError(listener: (error: any) => void): Disposable {
    this.stream.on('error', listener);
    return disosable(() => this.stream.off('error', listener));
  }

  public onEnd(listener: () => void): Disposable {
    this.stream.on('end', listener);
    return disosable(() => this.stream.off('end', listener));
  }

  public write(data: Uint8Array | string, encoding?: TranscodeEncoding): Promise<void> {
    return new Promise((resolve, reject) => {
      const callback = (error: Error | undefined | null) => {
        if (error === undefined || error === null) {
          resolve();
        } else {
          reject(error);
        }
      };
      console.log(`(LS) write ${typeof data} (enc: ${encoding}): ${typeof data === 'string' ? data : decoder.decode(data)}`);
      if (typeof data === 'string') {
        this.stream.write(data, encoding, callback);
      } else {
        this.stream.write(data, callback);
      }
    });
  }

  public end(): void {
    this.stream.end();
  }
}

export class StreamMessageReader extends ReadableStreamMessageReader {
  public constructor(readable: NodeJS.ReadableStream, encoding?: Encoding | MessageReaderOptions) {
    super(new ReadableStreamWrapper(readable), encoding);
  }
}

export class StreamMessageWriter extends WriteableStreamMessageWriter {
  public constructor(writable: NodeJS.WritableStream, options?: Encoding | MessageWriterOptions) {
    super(new WritableStreamWrapper(writable), options);
  }
}
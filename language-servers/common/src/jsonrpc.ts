import { type MessageReaderOptions, type MessageWriterOptions, ReadableStreamMessageReader, WriteableStreamMessageWriter, type Disposable } from "vscode-jsonrpc";

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

const disosable = (fn: () => void) => ({ dispose: fn });

const subscribe = <T>(stream: NodeJS.EventEmitter, key: string, listener: (...args: T[]) => void) => {
  stream.on(key, listener);
  return disosable(() => stream.off(key, listener));
}

const encoder = new TextEncoder();

// https://github.com/microsoft/vscode-languageserver-node/blob/df05883f34b39255d40d68cef55caf2e93cff35f/jsonrpc/src/node/ril.ts#L48
class ReadableStreamWrapper implements _ReadableStream {

  constructor(private stream: NodeJS.ReadableStream) {
  }

  public onClose(listener: () => void): Disposable {
    return subscribe(this.stream, 'close', listener);
  }

  public onError(listener: (error: any) => void): Disposable {
    return subscribe(this.stream, 'error', listener);
  }

  public onEnd(listener: () => void): Disposable {
    return subscribe(this.stream, 'end', listener);
  }

  public onData(listener: (data: Uint8Array) => void): Disposable {
    return subscribe(this.stream, 'data', listener);
  }
}

//https://github.com/microsoft/vscode-languageserver-node/blob/df05883f34b39255d40d68cef55caf2e93cff35f/jsonrpc/src/node/ril.ts#L74
class WritableStreamWrapper implements _WritableStream {

  constructor(private stream: NodeJS.WritableStream) {
  }

  public onClose(listener: () => void): Disposable {
    return subscribe(this.stream, 'close', listener);
  }

  public onError(listener: (error: any) => void): Disposable {
    return subscribe(this.stream, 'error', listener);
  }

  public onEnd(listener: () => void): Disposable {
    return subscribe(this.stream, 'end', listener);
  }

  public write(data: Uint8Array | string): Promise<void> {
    return new Promise((resolve, reject) => {
      data = typeof data === 'string' ? encoder.encode(data) : data;
      const callback = (error: Error | undefined | null) =>
        error === undefined || error === null ? resolve() : reject();
      this.stream.write(data, callback);
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
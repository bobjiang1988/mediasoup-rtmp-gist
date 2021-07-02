import { Consumer } from 'mediasoup/lib/Consumer';
import FFmpegStatic from 'ffmpeg-static';
import Process from 'child_process';
import fs from 'fs';
import path from 'path';
import { Producer } from 'mediasoup/lib/Producer';
import config from './config';
import { PlainTransport } from 'mediasoup/lib/PlainTransport';
import { getCodecInfoFromRtpParameters, getSdpText } from './sdp';

export interface FFMpegServiceOptions {
  transport: PlainTransport;
  producer: Producer;
  consumer: Consumer;
}

export class FFMpegService {
  private _transport: PlainTransport;
  private _producer: Producer;
  private _consumer: Consumer;
  private _process: Process.ChildProcessWithoutNullStreams;

  private readonly _sdpDir = path.resolve(__dirname, './sdp');

  constructor({ transport, producer, consumer }: FFMpegServiceOptions) {
    this._transport = transport;
    this._producer = producer;
    this._consumer = consumer;
    this._process = null;
  }

  public run() {
    this._createSdpFile();
    this._createProcess();
    this._handleProcess();
  }

  public async kill() {
    return new Promise<void>((resolve) => {
      if (!this._process) return resolve();
      this._process.kill('SIGINT');
      resolve();
    });
  }

  private _getSdpFile() {
    return `${this._sdpDir}/${this._producer.id}.sdp`;
  }

  private _createSdpFile() {
    fs.mkdirSync(this._sdpDir, {
      recursive: true
    });
    fs.writeFileSync(
      this._getSdpFile(),
      getSdpText(this._transport, this._producer, this._consumer)
    );
  }

  private get _video() {
    return this._producer.id === 'video';
  }

  private get _audio() {
    return this._producer.id === 'audio';
  }

  private get _rtmpVideoArgs() {
    if (!this._video) return [];

    return [
      '-map',
      '0:v:0',
      '-c:v',
      'libx264',
      '-tune',
      'zerolatency',
      '-preset',
      'ultrafast',
      '-b:v',
      '600k',

      '-g', // gop
      '24',
      '-r', // rate
      '24'
    ];
  }

  private get _rtmpAudioArgs(): any[] {
    if (!this._audio) return [];
    const codec = getCodecInfoFromRtpParameters(
      'audio',
      this._consumer.rtpParameters
    );
    return ['-map', '0:a:0', '-c:a', 'aac', '-ar', codec.clockRate];
  }

  private get _rtmpLocation() {
    return [
      '-f',
      'flv',
      `rtmp://${config.rtmp.host}/${this._producer.kind}/${this._producer.id}`
    ];
  }

  private get _commandArgs() {
    let args = [
      '-vsync',
      '1',
      '-async',
      '1',
      '-loglevel',
      'info',
      '-analyzeduration',
      '50000', // 50ms
      '-probesize',
      '1k',
      '-protocol_whitelist',
      'file,rtp,udp',
      '-fflags',
      '+genpts',

      '-i',
      this._getSdpFile()
    ];

    args = args.concat(this._rtmpVideoArgs);
    args = args.concat(this._rtmpAudioArgs);
    args = args.concat(this._rtmpLocation);

    return args;
  }

  private _createProcess() {
    this._process = Process.spawn(FFmpegStatic, this._commandArgs, {
      shell: false
    });
  }

  private _handleProcess() {
    this._process.on('error', (err) => {
      console.error('publish process error:', err);
    });

    this._process.on('exit', (code, signal) => {
      if (!signal || signal === 'SIGINT' || signal === 'SIGKILL') {
        console.log('process stopped');
      } else {
        console.warn("process didn't exit cleanly");
      }
      this._process = null;
    });

    this._process.stderr.on('data', (chunk) => {
      chunk
        .toString()
        .split(/\r?\n/g)
        .filter(Boolean)
        .forEach((line: any) => {
          console.log(line);
        });
    });
    process.on('exit', () => {
      console.log('process existed');
    });
  }
}

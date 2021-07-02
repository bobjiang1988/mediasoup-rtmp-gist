import { PlainTransport } from 'mediasoup/lib/PlainTransport';
import { Producer } from 'mediasoup/lib/Producer';
import { Router } from 'mediasoup/lib/Router';
import config from './config';
import { FFMpegService } from './ffmpeg';

const createTransport = async (router: Router) => {
  const transport = await router.createPlainTransport({
    ...config.mediasoup.plainTransportOptions,
    rtcpMux: false,
    comedia: false
  });

  // you should dynamic apply rtpPort and rtpPort
  // tip: rtcpPort = rtpPort + 1
  const rtpPort = 5000;
  const rtcpPort = 5001;

  await transport.connect({
    ip: config.mediasoup.plainTransportOptions.listenIp.ip,
    port: rtpPort,
    rtcpPort: rtcpPort
  });
  return transport;
};

const createConsumer = async (
  router: Router,
  transport: PlainTransport,
  producer: Producer
) => {
  const rtpCapabilities = {
    codecs: router.rtpCapabilities.codecs.filter((codec) => {
      if (codec.kind !== producer.kind) return false;
      if (producer.kind === 'video') {
        return codec.mimeType.toLowerCase().indexOf('h264') > -1;
      }
      return true;
    }),
    rtcpFeedback: []
  };

  return await transport.consume({
    producerId: producer.id,
    rtpCapabilities,
    paused: true
  });
};

const run = async (router: Router, producer: Producer) => {
  const transport = await createTransport(router);
  const consumer = await createConsumer(router, transport, producer);

  const service = new FFMpegService({ transport, producer, consumer });

  service.run();
};

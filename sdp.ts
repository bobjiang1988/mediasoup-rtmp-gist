import { Consumer } from 'mediasoup/lib/Consumer';
import { PlainTransport } from 'mediasoup/lib/PlainTransport';
import { Producer } from 'mediasoup/lib/Producer';
import { MediaKind, RtpParameters } from 'mediasoup/lib/RtpParameters';
import config from './config';

const parseParams = (obj: any) => {
  if (!obj) return;
  const keys = Object.keys(obj);

  if (!keys.length) return;
  const params = [];
  // level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f

  keys.forEach((key) => {
    params.push(`${key}=${obj[key]}`);
  });

  return params.join(';');
};

export const getCodecInfoFromRtpParameters = (
  kind: MediaKind,
  rtpParameters: RtpParameters
) => {
  const codec = rtpParameters.codecs[0];
  const encoding = rtpParameters.encodings[0];

  return {
    payloadType: codec.payloadType,
    codecName: codec.mimeType.replace(`${kind}/`, '').toLowerCase(),
    clockRate: codec.clockRate,
    parameters: parseParams(codec.parameters),
    channels: kind === 'audio' ? codec.channels : undefined,
    ssrc: encoding.ssrc
  };
};

export const getSdpText = (
  transport: PlainTransport,
  producer: Producer,
  consumer: Consumer
) => {
  let sdpText = '';

  const streamIp = config.mediasoup.plainTransportOptions.listenIp.ip;
  sdpText += 'v=0\n';
  sdpText += `o=- 0 0 IN IP4 ${streamIp}\n`;
  sdpText += 's=FFmpeg\n';
  sdpText += `c=IN IP4 ${streamIp}\n`;
  sdpText += 't=0 0\n';

  const remoteRtpPort = transport.tuple.remotePort;
  const remoteRtcpPort = transport.rtcpTuple.remotePort;
  const rtpParameters = consumer.rtpParameters;
  const codec = getCodecInfoFromRtpParameters(producer.kind, rtpParameters);

  if (producer.kind === 'video') {
    sdpText += `m=video ${remoteRtpPort} RTP/AVPF ${codec.payloadType}\n`;
    sdpText += `a=ssrc:${codec.ssrc}\n`;
    sdpText += `a=rtcp:${remoteRtcpPort}\n`;
    sdpText += `a=rtpmap:${codec.payloadType} ${codec.codecName}/${codec.clockRate}\n`;
    if (codec.parameters) {
      sdpText += `a=fmtp:${codec.payloadType} ${codec.parameters}\n`;
    }
  }

  if (producer.kind === 'audio') {
    sdpText += `m=audio ${remoteRtpPort} RTP/AVPF ${codec.payloadType}\n`;
    sdpText += `a=ssrc:${codec.ssrc}\n`;
    sdpText += `a=rtcp:${remoteRtcpPort}\n`;
    sdpText += `a=rtpmap:${codec.payloadType} ${codec.codecName}/${codec.clockRate}/${codec.channels}\n`;
    if (codec.parameters) {
      sdpText += `a=fmtp:${codec.payloadType} ${codec.parameters}\n`;
    }
  }
  return sdpText;
};

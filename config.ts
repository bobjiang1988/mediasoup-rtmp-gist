export default {
  mediasoup: {
    plainTransportOptions: {
      listenIp: {
        ip: process.env.SERVER_LISTEN_IP || '127.0.0.1',
        announcedIp: undefined
      },
      maxSctpMessageSize: 262144
    }
  },
  rtmp: {
    host: '127.0.0.1'
  }
};

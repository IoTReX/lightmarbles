var five = require ('johnny-five'),
    board = new five.Board(),
    photoresistor;

function getDecorateIO() {
  function decorateIO(io) {
  	board.on('ready', function() {

      photoresistor = new five.Sensor({
        pin: "A0",
        freq: 250
      });

      io.on('connection', function (socket) {
        console.log('sockets on connection');

        photoresistor.on('data', function(){
          var data = this.value;
          socket.emit('photoData', data);
        })
      });
    });
  };

  return decorateIO;
};

module.exports = getDecorateIO;
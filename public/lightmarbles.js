var socket = io.connect('http://localhost:8080', {reconnect: true});

function setupMarbelous(Rx){
  var recordObservation = Marbelous.createMarbleDisplay(document.getElementById('marbles-container'));

  Rx.Observable.prototype.visualize = function(name){
    this.inspectTime(60).subscribe(function(e){
    	return recordObservation(name,e);
    });

    return this;
  }
}

setupMarbelous(Rx);

source$ = Rx.Observable.fromEvent(socket, 'photoData').distinctUntilChanged();
source$.visualize('Photosensor Data');

var mins = source$
  .scan(Math.min)
  .distinctUntilChanged();

var maxes = source$
  .scan(Math.max)
  .distinctUntilChanged();

mins.visualize('Minimum Reading');
maxes.visualize('Maximum Reading');

var sub = source$
.subscribe(function(x){
		console.log('light sensor value: ' + x);
	}, function(err){
		console.error(err);
	}, function(){
		console.info('done');
	});

// setTimeout(function(){
// 	console.log('disposing');
// 	sub.dispose();
// }, 5000);
var socket = io.connect('http://localhost:8080', {reconnect: true});

const recordObservation = Marbelous.createMarbleDisplay(document.getElementById('marbles-container'));

function visualize(name,observable) {
  observable.subscribe( e => recordObservation(name,e) );
}

var source$ = Rx.Observable.fromEvent(socket, 'photoData').distinctUntilChanged();

visualize('Photosensor Data', source$);

var mins = source$
  .scan(Math.min)
  .distinctUntilChanged();

var maxes = source$
  .scan(Math.max)
  .distinctUntilChanged();

visualize('Minimum Reading', mins);
visualize('Maximum Reading', maxes);

var sub = source$
.subscribe(function (x) {
		console.log('light sensor value: ' + x);
        var sine1 = T("sin", {freq:x*.25, mul:0.5});
        var sine2 = T("sin", {freq:x, mul:0.5});

        T("perc", {r:800}, sine1, sine2).on("ended", function() {
          this.pause();
        }).bang().play();

	}, function(err){
		console.error(err);
	}, function(){
		console.info('done');
	});

var source2$ = Rx.Observable.fromEvent(socket, 'photoData2').distinctUntilChanged();
visualize('Photosensor 2 Data', source2$);

var sine3 = T("sin", {mul:0.5}).play();

var sub3 = source2$
.subscribe(function(x){
    console.log('light sensor 2 value: ' + x);
        var calc = 880-(x/4);
        sine3.set({freq:x});
  }, function(err){
    console.error(err);
  }, function(){
    console.info('done');
  });
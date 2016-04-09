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
        //sin.set({freq:x});
        
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

// var VCO = T("sin").play();
// var VCF = T("hpf", {cutoff:1600, Q:10}, VCO).play();

// var sub2 = source$
// .subscribe(function(x){
//     console.log('light sensor value: ' + x);
//         VCO.set({freq:x*.5});
//   }, function(err){
//     console.error(err);
//   }, function(){
//     console.info('done');
//   });

source2$ = Rx.Observable.fromEvent(socket, 'photoData2').distinctUntilChanged();
source2$.visualize('Photosensor 2 Data');

// var cutoff = T("sin", {freq:"400ms", mul:300, add:1760}).kr();
// var VCO2 = T("saw", {mul:0.2});
// var VCF2 = T("lpf", {cutoff:cutoff, Q:20}, VCO2).play();

var sine3 = T("sin", {mul:0.5}).play();

var sub3 = source2$
.subscribe(function(x){
    console.log('light sensor 2 value: ' + x);
        //VCF.set({cutoff:x*.25})

        // VCO2.freq.value   = x*.4;
        // VCF2.set({cutoff:x*.5});

        var calc = 880-(x/4);
        sine3.set({freq:x});
        //var sine4 = T("sin", {freq:calc, mul:0.5});

        

        // T("perc", {r:300}, sine3, sine4).on("ended", function() {
        //   this.pause();
        // }).bang().play();
  }, function(err){
    console.error(err);
  }, function(){
    console.info('done');
  });
// setTimeout(function(){
// 	console.log('disposing');
// 	sub.dispose();
// }, 5000);
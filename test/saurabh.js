// Bad code example
function fn(a, b) {
    var x = 10;
    var y = 5;
  
    if (a > b) {
      for (var i = 0; i < x; i++) {
        y += i;
      }
    } else {
      for (var j = 0; j < y; j++) {
        x -= j;
      }
    }
  
    return x + y;
  }
  
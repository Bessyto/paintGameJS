/*
    Bessy Torres-Miller
    paint.js
    06/01/2018
    Paint Program
    Code copied from the book "Eloquent JavaScript" Chapter 19
 */


/*
    It creates an element with the given name and attributes and appends all further arguments it gets as child nodes,
    automatically converting strings to text nodes.

*/
function elt(name, attributes) {
    var node = document.createElement(name);
    if (attributes) {
        for (var attr in attributes)
            if (attributes.hasOwnProperty(attr))
                node.setAttribute(attr, attributes[attr]);
    }
    for (var i = 2; i < arguments.length; i++) {
        var child = arguments[i];
        if (typeof child == 'string')
            child = document.createTextNode(child);
        node.appendChild(child);
    }
    return node;
}

//Define an object called controls, which will hold functions to initialize the various controls below the image
var controls = Object.create(null);

//Appends the paint interface to the DOM element it is given as an argument
function createPaint(parent) {
    var canvas = elt('canvas', {width: 500, height: 300});
    var cx = canvas.getContext('2d');

    //border for the canvas
    cx.lineWidth=4;
    cx.strokeStyle="#FF0000";
    cx.strokeRect(0,0,canvas.width,canvas.height);

    var toolbar = elt('div', {class: 'toolbar'});

    for (var name in controls)
        toolbar.appendChild(controls[name](cx));

    var panel = elt('div', {class: 'picturepanel'}, canvas);
    parent.appendChild(elt('div', null, panel, toolbar));
}



//object to collect the various tools. Associates the names of the tools with the function that should be called
// when they are selected and the canvas is clicked
var tools = Object.create(null);

/*The tool field is populated with <option> elements for all tools that have been defined. "mousedown" handler
  takes care of calling the function for the current tool, passing it both the event object and the drawing context.
   It also calls preventDefault so that holding the mouse button and dragging does not cause the browser to select
   parts of the page
*/
controls.tool = function(cx) {
    var select = elt('select');

    // populate the tools
    for (var name in tools)
        select.appendChild(elt('option', null, name));

    cx.canvas.addEventListener('mousedown', function(event) {

        if (event.which == 1) {
            tools[select.value](event, cx);
            event.preventDefault();
        }
    });

    return elt('span', null, 'Tool: ', select);
};

//To put the line ends in the right place, we need to be able to find the canvas-relative coordinates that a given
// mouse event corresponds to.
function relativePos(event, element) {
    var rect = element.getBoundingClientRect();
    return {x: Math.floor(event.clientX - rect.left),
        y: Math.floor(event.clientY - rect.top)};
}

/*Several of the drawing tools need to listen for "mousemove" events as long as the mouse button is held down.
  The trackDrag function takes care of the event registration and unregistration for such situations.
  Takes two arguments. One is a function to call for each "mousemove" event, and the other is a function to call
  when the mouse button is released
*/
function trackDrag(onMove, onEnd) {
    function end(event) {
        removeEventListener('mousemove', onMove);
        removeEventListener('mouseup', end);
        if (onEnd)
            onEnd(event);
    }
    addEventListener('mousemove', onMove);
    addEventListener('mouseup', end);
}

//Does the actual drawing
tools.Line = function(event, cx, onEnd) {
    cx.lineCap = 'round';

    var pos = relativePos(event, cx.canvas);
    trackDrag(function(event) {
        cx.beginPath();
        cx.moveTo(pos.x, pos.y);
        pos = relativePos(event, cx.canvas);
        cx.lineTo(pos.x, pos.y);
        cx.stroke();
    }, onEnd);
};


//The erase tool sets globalCompositeOperation to "destination-out", which has the effect of erasing the pixels we
// touch, making them transparent again.
tools.Erase = function(event, cx) {
    cx.globalCompositeOperation = 'destination-out';
    tools.Line(event, cx, function() {
        cx.globalCompositeOperation = 'source-over';
    });
};

// Whenever the value of the color field changes, the drawing context’s fillStyle and strokeStyle are updated to hold
// the new value.
controls.color = function(cx) {
    var input = elt('input', {type: 'color'});

    input.addEventListener('change', function() {
        cx.fillStyle = input.value;
        cx.strokeStyle = input.value;
    });
    return elt('span', null, ' Color: ', input);
};


//The code generates options from an array of brush sizes, and again ensures that the canvas’ lineWidth is updated
// when a brush size is chosen
controls.brushSize = function(cx) {
    var select = elt('select');
    var sizes = [1, 2, 3, 5, 8, 12, 25, 35, 50, 75, 100];

    sizes.forEach(function(size) {
        select.appendChild(elt('option', {value: size}, size + ' pixels'));
    });

    select.addEventListener('change', function() {
        cx.lineWidth = select.value;
    });
    return elt('span', null, '  Brush size: ', select);
};


controls.save = function(cx) {
    var link = elt('a', {href: '/', target: '_blank'}, ' Save');
    function update() {
        try {
            link.href = cx.canvas.toDataURL();
        } catch(e) {
            if (e instanceof SecurityError)
                link.href = 'javascript:alert(' +
                    JSON.stringify('Can\'t save: ' + e.toString()) + ')';
            else
                window.alert("Nope.");
            throw e;
        }
    }
    link.addEventListener('mouseover', update);
    link.addEventListener('focus', update);
    return link;
};

//Tries to load an image file from a URL and replace the contents of the canvas with it
function loadImageURL(cx, url)  {
    var image = document.createElement('img');
    image.addEventListener('load', function() {
        var color = cx.fillStyle, size = cx.lineWidth;
        cx.canvas.width = image.width;
        cx.canvas.height = image.height;
        cx.drawImage(image, 0, 0);
        cx.fillStyle = color;
        cx.strokeStyle = color;
        cx.lineWidth = size;
    });
    image.src = url;
}

//Load a local file uses the FileReader technique. Load the file that the user chose as a data URL and pass it to
// loadImageURL to put it into the canvas.
controls.openFile = function(cx) {
    var input = elt('input', {type: 'file'});
    input.addEventListener('change', function() {
        if (input.files.length == 0) return;
        var reader = new FileReader();
        reader.addEventListener('load', function() {
            loadImageURL(cx, reader.result);
        });
        reader.readAsDataURL(input.files[0]);
    });

    return elt('div', null, 'Open file: ', input);
};


//Wraps a text field in a form and responds when the form is submitted, either because the user pressed Enter or because
// they clicked the load button.
controls.openURL = function(cx) {
    var input = elt('input', {type: 'text'});
    var form = elt('form', null, 'Open URL: ', input,
        elt('button', {type: 'submit'}, 'load'));
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        loadImageURL(cx, form.querySelector('input').value);
    });
    return form;
};

//add a text tool that uses prompt to ask the user which string it should draw
tools.Text = function(event,cx) {
    var text = prompt (" Text :" , "") ;
    if (text) {
        var pos = relativePos(event , cx.canvas) ;
        cx.font = Math.max(7 , cx.lineWidth) + " px sans - serif ";
        cx.fillText(text , pos.x , pos.y) ;
    }
};


//draws dots in random locations under the brush as long as the mouse is held down, creating denser or less dense
//speckling based on how fast or slow the mouse moves.
tools.Spray = function(event, cx) {
    var radius = cx.lineWidth / 2;
    var area = radius * radius * Math.PI;
    var dotsPerTick = Math.ceil(area / 30);

    var currentPos = relativePos(event, cx.canvas);
    var spray = setInterval(function() {
        for (var i = 0; i < dotsPerTick; i++) {
            var offset = randomPointInRadius(radius);
            cx.fillRect(currentPos.x + offset.x,
                currentPos.y + offset.y, 1, 1);
        }
    }, 25);
    trackDrag(function(event) {
        currentPos = relativePos(event, cx.canvas);
    }, function() {
        clearInterval(spray);
    });
};

//To find a random position under the brush. Generates points in the square between (-1,-1) and (1,1).
//Using the Pythagorean theorem, it tests whether the generated point lies within a circle of radius 1.
// As soon as the function finds such a point, it returns the point multiplied by the radius argument.
function randomPointInRadius(radius) {
    for (;;) {
        var x = Math.random() * 2 - 1;
        var y = Math.random() * 2 - 1;

        if (x * x + y * y <= 1)
            return {x: x * radius, y: y * radius};
    }
}


var appDiv = document.querySelector('#paint');
createPaint(appDiv);



# alphacontrast
Alpha Contrast

This is a script to allow web objects (images, containers, text, etc.) to reference the content in the visible layer directly behind it and recolor the object pixel by pixel to display the contrasting color.

Each pixel interrogates the visible content behind itself and sets the color mask to directly contrast. If no content is present in a given pixel within the boundaries of the top image (transparent sections of a png), the pixel is ignored.

The Alpha Contrast script can be included in the header of a given web document (html, php, etc.) and activated by setting a divider's class to include the parameter "alphacontrast".

Ex. <div class="alphacontrast" style="z-index:2;"><h1>Hello World</h1></div>
<img style="z-index:1;width:500px;" src="http://offair.org/testPattern.png">

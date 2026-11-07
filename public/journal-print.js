// The journal's print page, /api/journal/[id]/download. A file of the site's own because
// the Content-Security-Policy refuses inline script, as it should, and allows this.
(function () {
  var button = document.getElementById("print-entry");
  if (button) {
    button.addEventListener("click", function () {
      window.print();
    });
  }
  // A moment after load, so the dialog shows the finished page.
  window.addEventListener("load", function () {
    setTimeout(function () {
      window.print();
    }, 200);
  });
})();

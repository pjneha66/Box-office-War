/* Box Office War — in-game Help. A short orientation sheet reachable from the gear menu.
   Presentation only: no state is read or written, so it cannot change game logic. */
var HELP_DESKS = [
  { id: "help-guide", group: "Help", icon: "❔", name: "How to play",
    desc: "The four tabs, the weekly loop, and where things live.",
    render: helpBody }
];

function helpBody() {
  var rows = [
    ["🏠", "Studio", "Hire talent, staff the lot, and greenlight projects. Hall of Fame and challenge runs live under Production."],
    ["🎬", "Develop", "Shape scripts, creative choices, posters, and your game studio."],
    ["🎟️", "Playing", "Track the weekend box-office chart, schedule releases, and open the Collection to run box-office levers."],
    ["🪙", "Business", "Cash flow, finance desk, licensing, and your empire."]
  ];
  var html = '<div class="card">';
  rows.forEach(function (r) {
    html += '<p class="tiny" style="margin:10px 0;line-height:1.45">' + r[0] + " <b>" + esc(r[1]) + "</b> — " + esc(r[2]) + "</p>";
  });
  html += "</div>";
  html += '<div class="sechead"><h2>The weekly loop</h2></div>'
    + '<div class="card"><p class="tiny muted">Press <b>Week</b> at the bottom to advance time. Films open, earn, and fade on the weekend chart. '
    + "Cash, reputation, and buzz decide what you can afford next.</p></div>";
  html += '<div class="sechead"><h2>Settings &amp; save slots</h2></div>'
    + '<div class="card"><p class="tiny muted">Tap the ⚙️ gear in the header for settings, save slots, and the studio logo.</p></div>';
  return html;
}

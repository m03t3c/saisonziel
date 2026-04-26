/*****************************************************************************
MIT License
 
Copyright (c) 2024 m03t3c 
https://github.com/m03t3c/saisonziel/

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
********************************************************************************/


var saisonziel="ChampionsLeague";
// Per-league configuration. The `goals` keys (league/int/cl/win) are stable
// identifiers shared with the goal-button IDs in index.html and the algorithm
// in buildTable(). Each goal's `pos` is the 0-indexed standings position of
// the highest team that does NOT achieve that goal (i.e., the threshold just
// below the line). `label` is a {de, en} object with the display name shown
// on the goal button per UI language. `name` likewise carries the league's
// display name in both languages for the league nav.
//
// The matchday count per league is derived dynamically in buildTable() from
// the standings length ((N-1)*2 for a round-robin), so it does not need to be
// configured per league and adapts automatically when a league's team count
// changes (e.g., the Frauen-Bundesliga went 12→14 teams between 2024/25 and
// 2025/26).
var config = {
	bl1: {
		name: { de: "Bundesliga", en: "Bundesliga" },
		goals: {
			league: { pos: 15, label: { de: "Klassenerhalt",   en: "Avoid relegation" } },  // top 15 safe (16 = Relegationsplatz)
			int:    { pos: 6,  label: { de: "International",   en: "European spot" } },     // top 6 international
			cl:     { pos: 4,  label: { de: "Champions League", en: "Champions League" } }, // top 4 (incl. recent coefficient bonus spot)
			win:    { pos: 1,  label: { de: "Meister",         en: "Champion" } }           // top 1
		}
	},
	bl2: {
		name: { de: "2. Bundesliga", en: "2. Bundesliga" },
		goals: {
			league: { pos: 15, label: { de: "Klassenerhalt",       en: "Avoid relegation" } },  // top 15 safe (16 = Relegationsplatz)
			int:    { pos: 3,  label: { de: "Aufstiegsrelegation", en: "Promotion playoff" } }, // top 3 (incl. playoff spot)
			cl:     { pos: 2,  label: { de: "Direktaufstieg",      en: "Direct promotion" } },  // top 2 directly promoted
			win:    { pos: 1,  label: { de: "Meister",             en: "Champion" } }           // top 1
		}
	},
	fbl1: {
		name: { de: "Frauen-Bundesliga", en: "Women's Bundesliga" },
		goals: {
			// `league` assumes the 14-team format with bottom 2 directly relegated
			// (no playoff); if the league restructures, update this number.
			league: { pos: 12, label: { de: "Klassenerhalt",   en: "Avoid relegation" } },  // top 12 of 14 safe
			// The Frauen-Bundesliga's only European competition is the UWCL:
			// 1st = direct Ligenphase, 2nd & 3rd = Qualifikation. There is no
			// Europa-League/Europa-Cup equivalent for women, so `int` (any
			// European spot) collapses onto the same top-3 threshold as `cl`.
			// Both buttons therefore compute identical targets for fbl1.
			int:    { pos: 3,  label: { de: "International",   en: "European spot" } },     // top 3 = any CL spot
			cl:     { pos: 3,  label: { de: "Champions League", en: "Champions League" } }, // top 3 (1 direct group stage + 2 qualifying)
			win:    { pos: 1,  label: { de: "Meister",         en: "Champion" } }           // top 1 = title + direct CL Ligenphase
		}
	},
	fbl2: {
		name: { de: "2. Frauen-Bundesliga", en: "Women's 2. Bundesliga" },
		goals: {
			// 14-team format (2025/26); bottom 2 directly relegated to the
			// Frauen-Regionalliga. Same caveat as fbl1: bump if the league
			// restructures.
			league: { pos: 12, label: { de: "Klassenerhalt", en: "Avoid relegation" } },  // top 12 of 14 safe
			// Unlike the men's 2. Bundesliga, fbl2 has NO 3rd-place
			// Aufstiegsrelegation playoff — only the top 2 are promoted to
			// the Frauen-Bundesliga. So there is only one promotion goal,
			// `int` (label "Aufstieg"/"Promotion"), and `cl` is omitted
			// entirely (updateData hides any button not in this config).
			int:    { pos: 2,  label: { de: "Aufstieg",      en: "Promotion" } },         // top 2 promoted
			win:    { pos: 1,  label: { de: "Meister",       en: "Champion" } }           // top 1
		}
	}
};

// Static UI strings, keyed by `data-i18n` attributes in index.html. setLang(l)
// sweeps the DOM and replaces innerHTML for each [data-i18n] element with the
// corresponding string from this table. Dynamic strings live elsewhere: league
// names and goal labels are {de, en} pairs in the `config` object above; the
// status icon alt texts are constructed inside buildTable() from `legend_*`
// keys at render time.
var translations = {
	de: {
		pageTitle: "Bundesliga Saisonzielrechner",
		h1: "Saisonzielrechner",
		subtitle: "Haben wir den Klassenerhalt schon sicher? Können wir noch international spielen?",
		debugLabel: "Debug Data:",
		ligaLabel: "Liga:",
		saisonzielLabel: "Saisonziel:",
		matchdayLabel: "Spieltag:",
		resultText: 'Mannschaften, die aktuell in der Tabelle noch nicht auf einem Platz ihres Saisonziels stehen, benötigen <span id="Zielpunkte"></span> Punkte.<br /><span id="ind_ziel_text" style="display: none;">Ansonsten genügen <span id="ind_ziel"></span> Punkte.</span>',
		th_pos: "Pl",
		th_team: "Verein",
		th_md: "Sp",
		th_pts: "Pk",
		th_target: "Zi",
		th_need: "Fhl",
		th_status: "Status",
		legendTitle: "Legende",
		legend_md_label: "Sp",
		legend_md_text: "Spieltag",
		legend_pts_label: "Pk",
		legend_pts_text: "Punkte bisher",
		legend_target_label: "Zi",
		legend_target_text: "Zielpunkte (zu erreichend für Saisonziel)<br />*) diese Punkte sind in den ausstehenden Spieltagen nicht mehr erreichbar, werden aber der Vollständigkeit noch angezeigt.",
		legend_need_label: "Fhl",
		legend_need_text: "Fehlende Punkte bis zum Saisonziel",
		legend_done: "Saisonziel erreicht",
		legend_open: "Saisonziel aus eigener Kraft erreichbar",
		legend_help: "Saisonziel nur noch mit Schützenhilfe erreichbar",
		legend_missed: "Saisonziel verpasst",
		legend_icons: 'Icons von <a target="_blank" href="https://icons8.com">Icons8</a>',
		calcTitle: "Berechnung",
		calc_p1: 'Die Berechnungsmethodik basiert auf dem mathematischen Rätsel von <a href="https://www.spektrum.de/raetsel/meister-und-absteiger/1777404" target="_blank">Heinrich Hemme: Welches ist die höchste Punktzahl, mit der man absteigen kann?</a>. Dabei werden alle zu erreichenden Punkte zwischen den Plätzen 1-16 gleichverteilt.',
		calc_p2: 'Ich habe diese Methodik wie folgt adaptiert: Wenn der Absteiger die höchste maximale Punktzahl erreicht, muss der erste Nichtabsteiger mindestens einen Punkt mehr haben. (Ich lasse hier die Tordifferenz bewusst außer acht, da die Frage, ab wann eine bestimmte Differenz ausreicht, wohl nicht abschließend geklärt werden kann (siehe zum Beispiel <a href="https://11freunde.de/artikel/drama-baby-drama/8605211" target="_blank">die Bundesligasaison 1977/78</a>). Und es die Berechnung vereinfacht. Außerdem geht es mir darum, ob das Saisonziel aus eigener Kraft erreicht werden kann. Darüber hinaus betrachte ich den Relegationsplatz 16. als einen Abstiegsplatz.)',
		calc_p3: 'Eine weitere Adaption war notwendig, da Heinrich Hemmes Berechnung den Idealzustand am Saisonbeginn simuliert. Mit fortlaufendem Saisonverlauf ändert sich allerdings die Situation, da Mannschaften im oberen Teil der Tabelle bereits Punkte eingefahren haben, teilweise natürlich auch über das Ziel hinaus. Dadurch werden hier bei der Verteilung der noch ausstehenden Punkte die bereits erzielten Punkte über Platz 16 zunächst herausgerechnet. Schematisch ergibt sich damit folgende Berechnung der zu erreichenden Punktzahl:',
		calc_formula: '(<br />&nbsp;(((ausstehende Spiele - Spiele von Mannschaften auf den Plätzen 17-18 gegeneinander) * 3) <br />&nbsp;&nbsp;- Summe aller bereits erreichten Punkte über dem letztem Abstiegsplatz <br />&nbsp;) <br />&nbsp;/ Anzahl aller noch nicht gesichert-geretteten Mannschafften plus beste Abstiegsmannschaft<br />) <br />+ Punkte der besten noch nicht gesichert-geretteten Mannschaft <br />+ 1',
		calc_p4: 'In diese Berechnungen werden nur Mannschaften einbezogen, die noch nicht gesichert abgestiegen oder gerettet sind. Die selbe Methodik lässt sich auch auf das Erreichen der internationalen Plätze, der Champions League, und sogar des Meistertitels anwenden.',
		calc_p5: 'Die für das jeweilige Saisonziel zu erreichende Punktzahl für Mannschaften, die noch keinen solchen Platz innehaben (also sich unter dem Strich befinden), muss man wie folgt interpretieren: Wieviele Punkte sind notwendig, um auf jeden Fall noch das Saisonziel zu erreichen. Mannschaften, die einen solchen, als Saisonziel qualifizierenden Tabellenplatz schon einnehmen, müssen lediglich diejenige Anzahl an Punkten erreichen, die an den verbleibenden Spieltagen von der am besten nicht-qualifizierten Mannschaft nicht mehr erreicht werden kann (also mehr als (ausstehende Spiele)*3). Diese Unterscheidung ist notwendig, da solche Mannschaften anderen keine Punkte mehr wegnehmen müssen.',
		calc_p6: 'Für die Tabelle oben kann <a href="javascript:toggleDebug();">ein Debug-Modus aktiviert/deaktiviert werden</a>, um verschiedene Beispielspieltage aus der Saison 2022/2023 zu testen.',
		calc_p7: 'Die Daten werden übrigens per API von <a href="https://www.openligadb.de" target="_blank">OpenLigaDB</a> bereitgestellt, die Icons von <a target="_blank" href="https://icons8.com">Icons8</a>. OpenLigaDB deckt aktuell die hier eingebundenen vier deutschen Ligen ab; um weitere Ligen (etwa die Premier League) zu integrieren, wäre ein API-Zugang zu den jeweiligen Ligadaten nötig.',
		calc_p8: 'Anregungen, Feedback oder Probleme bitte auf der <a href="https://github.com/m03t3c/saisonziel/issues" target="_blank">GitHub-Seite dieses Projektes</a> melden.',
		bgTitle: "Hintergrund",
		bg_p1: 'Als Fan des VfB Stuttgarts erlebe ich im Herbst/Winter 2023 eine lang vermisste Euphorie ob der guten Ergebnisse der Mannschaft. Dennoch haben die letzten Jahre mit zwei Abstiegen und vielen bangen Momenten im Abstiegskampf tiefe Narben hinterlassen, so dass es erstmal gilt ein solches erneutes Szenario nicht wieder zu erleben. Und während es Erfahrungswerte gibt ("mit 40 Punkten ist man gerettet"), möchte ich lieber ganz genau wissen, ab wann der VfB nichts mehr mit dem Abstieg zu tun hat. Und so entstand dieses kleine Projekt.',
		footer: 'Copyright © 2024 <a href="https://github.com/m03t3c/saisonziel/" target="_blank">m03t3c</a>'
	},
	en: {
		pageTitle: "Bundesliga Season Goal Calculator",
		h1: "Saisonzielrechner",
		subtitle: "Have we secured survival yet? Can we still qualify for European football?",
		debugLabel: "Debug Data:",
		ligaLabel: "League:",
		saisonzielLabel: "Goal:",
		matchdayLabel: "Matchday:",
		resultText: 'Teams currently below the line for their seasonal goal need <span id="Zielpunkte"></span> points.<br /><span id="ind_ziel_text" style="display: none;">Otherwise <span id="ind_ziel"></span> points are enough.</span>',
		th_pos: "Pos",
		th_team: "Club",
		th_md: "MD",
		th_pts: "Pts",
		th_target: "Tgt",
		th_need: "Diff",
		th_status: "Status",
		legendTitle: "Legend",
		legend_md_label: "MD",
		legend_md_text: "Matchday",
		legend_pts_label: "Pts",
		legend_pts_text: "Points so far",
		legend_target_label: "Tgt",
		legend_target_text: "Target points (needed to reach the seasonal goal)<br />*) these points are no longer mathematically attainable in the remaining matchdays, but are still shown for completeness.",
		legend_need_label: "Diff",
		legend_need_text: "Points still needed to reach the goal",
		legend_done: "Goal achieved",
		legend_open: "Goal still attainable on own merit",
		legend_help: "Goal only attainable with help from others",
		legend_missed: "Goal missed",
		legend_icons: 'Icons by <a target="_blank" href="https://icons8.com">Icons8</a>',
		calcTitle: "Calculation",
		calc_p1: 'The calculation method is based on Heinrich Hemme\'s mathematical puzzle <a href="https://www.spektrum.de/raetsel/meister-und-absteiger/1777404" target="_blank">"What is the highest point total with which a team can still get relegated?"</a>. The remaining points to be earned are distributed evenly across positions 1–16.',
		calc_p2: 'I\'ve adapted this method as follows: if the relegated team reaches its highest possible point total, the first non-relegated team must have at least one point more. (I deliberately ignore goal difference here, since the question of how much of a difference is enough probably can\'t be answered definitively (see for example <a href="https://11freunde.de/artikel/drama-baby-drama/8605211" target="_blank">the 1977/78 Bundesliga season</a>). And it simplifies the calculation. Beyond that, what I care about is whether the seasonal goal can be reached on the team\'s own merit. I also treat the relegation playoff slot — 16th place — as a relegation place.)',
		calc_p3: 'A further adaptation was necessary because Heinrich Hemme\'s calculation simulates the ideal state at the start of the season. As the season progresses, the situation changes: teams in the upper half of the table have already collected points — sometimes well in excess of what they need. So when distributing the remaining points, points already earned above 16th place are first subtracted out. Schematically the calculation looks like this:',
		calc_formula: '(<br />&nbsp;(((remaining matches - matches between teams in positions 17-18) * 3) <br />&nbsp;&nbsp;- sum of all points already earned above the lowest relegation place <br />&nbsp;) <br />&nbsp;/ number of teams not yet definitively safe plus the best relegation-zone team<br />) <br />+ points of the best team not yet definitively safe <br />+ 1',
		calc_p4: 'Only teams that are neither definitively relegated nor definitively safe are included in these calculations. The same method can also be applied to reaching the European spots, the Champions League, and even the title.',
		calc_p5: 'The target points for teams that don\'t yet hold a qualifying position (i.e. that are below the line) should be interpreted as: how many points are needed to definitely reach the seasonal goal. Teams that already hold a qualifying position only need to reach the number of points the best non-qualifying team can no longer mathematically catch (i.e. more than (remaining matches)*3). This distinction is necessary because such teams no longer need to take points away from anyone.',
		calc_p6: 'For the table above, <a href="javascript:toggleDebug();">a debug mode can be toggled on/off</a> to test various example matchdays from the 2022/23 season.',
		calc_p7: 'The data, by the way, is provided via the <a href="https://www.openligadb.de" target="_blank">OpenLigaDB</a> API, the icons by <a target="_blank" href="https://icons8.com">Icons8</a>. OpenLigaDB currently covers the four German leagues integrated here; adding further leagues (e.g. the Premier League) would require API access to the respective league\'s data.',
		calc_p8: 'Please report suggestions, feedback or issues on this <a href="https://github.com/m03t3c/saisonziel/issues" target="_blank">project\'s GitHub page</a>.',
		bgTitle: "Background",
		bg_p1: 'As a VfB Stuttgart fan, autumn/winter 2023 brought a long-missed euphoria thanks to the team\'s good results. Still, the past years with two relegations and many anxious moments in the relegation battle have left deep scars, so the priority is not to relive such a scenario. And while there are rules of thumb ("40 points and you\'re safe"), I would much rather know exactly when VfB has nothing more to do with the relegation fight. And that\'s how this little project came about.',
		footer: 'Copyright © 2024 <a href="https://github.com/m03t3c/saisonziel/" target="_blank">m03t3c</a>'
	}
};

// debug mode - see data below
var debug = false;

// Active UI language. Read from localStorage so the choice persists across
// reloads. setLang(l) updates this and re-renders all translatable strings.
var lang = (function() {
	try {
		var stored = localStorage.getItem("saisonziel.lang");
		if(stored && translations[stored]) return stored;
	} catch(e) {}
	return "de";
})();

// Returns the OpenLiga DB season identifier for the currently running
// Bundesliga season (the year in which the season started). The Bundesliga
// runs August–May; fixtures for the upcoming season are published in early
// July, so we switch over at the start of July.
function getCurrentSeason() {
	var now = new Date();
	return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

var saison = getCurrentSeason();
var league = "bl1";
var spiele_egal=0;
var platz = 15;
var spieltag=0;
var ziel;
 
var gotMatches = false;
var tabelle = [];
var liveTabelle = [];      // snapshot of the live API standings; tabelle is replaced with a historical
                           // recomputation when viewMatchday is set, so we keep the live one separate
                           // for the navigator (it always reflects the real current matchday).
var viewMatchday = null;   // null = live view; integer = render standings as of that matchday
var matches = [];
var request = "";

// debug data -- can be set via toggleDebug as well
if(debug) {
	saison = 2022;
	spieltag = 30; // try 0, 10, 26, 30, 32, 33
	document.getElementById("debug").setAttribute('style','display:block;');
}


applyStaticI18n();
updateData(ziel);

// Sweep every [data-i18n] element in the DOM and replace innerHTML with the
// matching string from `translations[lang]`. Also swaps the document title,
// the active-language button highlight, and the league-nav button labels
// (config[*].name[lang]). Does NOT touch goal-button labels or the result
// table — those are rendered by updateData/buildTable, which read `lang`
// directly when invoked.
function applyStaticI18n() {
	if(!translations[lang]) return;
	var i;

	// Mark the active language button
	var langlinks = document.getElementsByClassName("langlink");
	for(i = 0; i < langlinks.length; i++) {
		langlinks[i].className = langlinks[i].className.replace(" w3-white", "");
	}
	var activeLangBtn = document.getElementById("lang-" + lang);
	if(activeLangBtn) activeLangBtn.className += " w3-white";

	// Page title
	if(translations[lang].pageTitle) document.title = translations[lang].pageTitle;

	// Sweep all [data-i18n] elements and replace their innerHTML
	var els = document.querySelectorAll("[data-i18n]");
	for(i = 0; i < els.length; i++) {
		var key = els[i].getAttribute("data-i18n");
		if(translations[lang][key] != null) els[i].innerHTML = translations[lang][key];
	}

	// Update league nav button labels (config[*].name[lang])
	for(var slug in config) {
		var btn = document.getElementById("lg-" + slug);
		if(btn && config[slug].name && config[slug].name[lang]) {
			btn.innerHTML = config[slug].name[lang];
		}
	}
}

// Switch the active UI language. Persists to localStorage, refreshes static
// i18n, and re-runs updateData(ziel) so goal-button labels and status icon
// alt text in the table also pick up the new language.
function setLang(l) {
	if(!translations[l] || l === lang) return;
	lang = l;
	try { localStorage.setItem("saisonziel.lang", l); } catch(e) {}
	applyStaticI18n();
	updateData(ziel);
}

// Toggle the global loading state. While `body.is-loading` is set, the table
// dims to ~35% opacity (CSS in index.html) and the centered gear-overlay SVG
// is shown. Bracket every API-driven refresh so the user gets feedback while
// standings + matches requests are in flight (the two requests are sequential,
// so a single show/hide pair around the whole chain is enough).
function showLoading() { document.body.classList.add("is-loading"); }
function hideLoading() { document.body.classList.remove("is-loading"); }

function updateData(z="league") {
	showLoading();
	ziel=z;
	if(!config[league]) league = "bl1";
	var goalDef = config[league].goals[ziel];
	if(!goalDef) {
		ziel = "league";
		goalDef = config[league].goals.league;
	}
	platz = goalDef.pos;

	if(debug) console.log("updating Data for:\nLeague:"+league+".\ntarget:"+ziel+".\nstanding:"+platz);
	tabelle = [];
	spiele_egal=0;
	request = "";
	// document.getElementById("zieltabelle").innerHTML="";

	// updating top-level league nav
	var li, leaguelinks = document.getElementsByClassName("leaguelink");
	for (li = 0; li < leaguelinks.length; li++) {
		leaguelinks[li].className = leaguelinks[li].className.replace(" w3-white", "");
	}
	var activeLeagueBtn = document.getElementById("lg-"+league);
	if(activeLeagueBtn) activeLeagueBtn.className += " w3-white";

	// updating goal navigation bar - reset, relabel for the active league, then mark active
	var i, x, tablinks;
	tablinks = document.getElementsByClassName("tablink");
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(" w3-white", "");
		tablinks[i].className = tablinks[i].className.replace(" w3-red", "");
	}
	// Iterate over the stable set of goal-button IDs. For each, show +
	// relabel if defined in the active league's config, otherwise hide it.
	// Lets a league omit a button entirely (e.g. fbl2 hides `cl` because
	// "Direktaufstieg" is identical to its `int` "Aufstieg" — top 2 promoted).
	var allGoalKeys = ["league", "int", "cl", "win"];
	for (i = 0; i < allGoalKeys.length; i++) {
		var goalBtn = document.getElementById(allGoalKeys[i]);
		if(!goalBtn) continue;
		var def = config[league].goals[allGoalKeys[i]];
		if(def) {
			goalBtn.innerHTML = (def.label && def.label[lang]) || (def.label && def.label.de) || "";
			goalBtn.style.display = "";
		} else {
			goalBtn.style.display = "none";
		}
	}
	document.getElementById(ziel).className += " w3-white";
	if(debug) document.getElementById("debug"+spieltag).className += " w3-red";

	request = new XMLHttpRequest();
	
	if(debug) request.open("GET","testdata/data-2022-"+spieltag+".json");
	else request.open("GET","https://api.openligadb.de/getbltable/"+league+"/"+saison);
	request.setRequestHeader("accept","text/json");
	request.addEventListener('load', function(event) {
	   if (request.status >= 200 && request.status < 300) {
	    				tabelle=JSON.parse(request.responseText);
		  	liveTabelle=tabelle;
		  	spieltag=tabelle[platz]["matches"];
		  	var punkte=tabelle[platz]["points"];
		  	var spiele_egal_mannschaften = new Array();
		  	getMatches();
	   } else {
	     	console.warn(request.statusText, request.responseText);
	     	hideLoading();
	   }
	});
	request.addEventListener('error', hideLoading);
	request.send();
}


function buildTable() {

	// Status icon HTML, rebuilt per render so the alt text reflects the
	// current UI language (toggled via setLang()).
	var t = translations[lang];
	var txt_erreicht = "<img src='icons/1.png' alt='" + t.legend_done   + "'/>";
	var txt_verpasst = "<img src='icons/4.png' alt='" + t.legend_missed + "'/>";
	var txt_moeglich = "<img src='icons/3.png' alt='" + t.legend_help   + "'/>";
	var txt_offen    = "<img src='icons/2.png' alt='" + t.legend_open   + "'/>";

	// Render the matchday navigator (1..currentMatchday) and, if the user has
	// selected a past matchday, replace `tabelle` with a historical recompute
	// derived from the already-fetched `matches`. The rest of the algorithm
	// then runs unchanged against the rewound standings.
	var currentMatchday = 0;
	for (let i = 0; i < liveTabelle.length; i++) {
		if (liveTabelle[i]["matches"] > currentMatchday) currentMatchday = liveTabelle[i]["matches"];
	}
	renderMatchdayNav(currentMatchday);
	if (viewMatchday !== null && viewMatchday < currentMatchday) {
		tabelle = computeStandingsAtMatchday(matches, viewMatchday, liveTabelle);
	} else {
		tabelle = liveTabelle;
	}

	// Total matchdays in a round-robin (home + away) league: (N-1) * 2.
	// Derived from the standings rather than configured so leagues with a
	// variable team count (e.g., the Frauen-Bundesliga, which went 12→14 in
	// 2025/26) just work without manual updates.
	var mdcount = (tabelle.length - 1) * 2;
	spieltag=tabelle[platz]["matches"];
	var punkte=tabelle[platz]["points"];

	// take secured qualifiers/disqualifiers out of the calculation
	var includedTeams = new Array();
	var countTeams = 0;
	for(let i = 0; i<tabelle.length; i++) {
		if((tabelle[i]["points"]<=((mdcount-tabelle[platz]["matches"])*3)+tabelle[platz]["points"]) && (tabelle[platz-1]["points"]<=((mdcount-tabelle[i]["matches"])*3)+tabelle[i]["points"])) { 
		// if my points do not qualify yet for the target after match 34 and if the target position can still be obtained with my points after match 34 (is still in reach)
			tabelle[i]["standing"] = i;
			includedTeams.push(tabelle[i]);
			if(i<=platz) countTeams++;
			if(debug) console.log("including in calculation team: "+tabelle[i]["teamName"]+" with "+tabelle[platz]["matches"]+" matches");
		}
	}
	var gamesCount=0;
	var gamesExcluded=0;
  	var diff_vorgaenger = 0; 
  	for(let t1 =0; t1<includedTeams.length; t1++) {
		if(includedTeams[t1]["standing"] <= platz) diff_vorgaenger += includedTeams[0]["points"]-includedTeams[t1]["points"]; // add point difference to highest team still not secured
		if(debug) console.log("checking gamesCount: team #"+t1+" position: "+includedTeams[t1]["standing"]+"; Team: "+includedTeams[t1]["teamName"]+" with "+(mdcount-includedTeams[t1]["matches"])+" matches; out of "+includedTeams.length+" teams included.");
		gamesCount += mdcount-includedTeams[t1]["matches"];
		for(let t2=0; t2<includedTeams.length; t2++) {
			if(includedTeams[t1]["teamInfoId"]==includedTeams[t2]["teamInfoId"]) continue;
			for(let m=0; m<matches.length; m++) {
				
				if(matches[m]["team1"]["teamId"]==includedTeams[t1]["teamInfoId"] && matches[m]["team2"]["teamId"]==includedTeams[t2]["teamInfoId"] && matches[m]["group"]["groupOrderID"]>spieltag) {
					// TODO: vergleich mit spieltag hinkt bei nachholspielen (e.g. FCB-RBL). Besser Spieltagsdatum?!
					gamesExcluded++; // need to exclude amount of games against each other (only one team of one match can gain 3 points)
					if(includedTeams[t1]["standing"]>platz && includedTeams[t2]["standing"]>platz) {
						gamesExcluded++; // games with teams "below the line" only should not count
						if(debug) console.log("triggered exclusion of: "+platz+"(target): "+includedTeams[t1]["teamName"]+"-"+includedTeams[t1]["standing"]+". and "+includedTeams[t2]["teamName"]+"-"+includedTeams[t2]["standing"]+".");
					}
				}
			}
		}
	}
	if(debug) console.log("# games excluded: "+gamesExcluded+".\ntotal games:"+gamesCount+".\npoints difference:"+diff_vorgaenger);
	// target points calculation:
	// When countTeams is 0, every current qualifier is mathematically out of
	// reach for the threshold team — the qualifying spots are locked. The
	// distribution formula would divide by zero (→ Infinity). The meaningful
	// target in that case is "one more point than the worst qualifier's
	// max-possible end-of-season total" (= the existing ind_ziel fallback),
	// which is what a below-line team would need to leapfrog the line.
	var zielpunkte;
	if(countTeams === 0) {
		zielpunkte = ((mdcount-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"];
	} else {
		zielpunkte = Math.floor(((((gamesCount-gamesExcluded)*3)-diff_vorgaenger)/(countTeams))+includedTeams[0]["points"])+1;
	}
	if(debug) { // some debugging output
		console.log("Target points rounded:"+zielpunkte);
	  	console.log("Target points calculatory (not rounded, not +1):"+((((((gamesCount-gamesExcluded)*3)-diff_vorgaenger)/(countTeams))+includedTeams[0]["points"]))+
	  		"\nmatch day#: "+spieltag+"\ntarget position:"+platz+"\npunkte: "+punkte);
		console.log("Zielpunkte gemittelt zu addieren:"+((((((gamesCount-gamesExcluded)*3)-diff_vorgaenger)/(countTeams)))));
		console.log("!!! Calculation: floor(((((("+gamesCount+"-"+gamesExcluded+")*3)-"+diff_vorgaenger+")/("+(countTeams)+"))+"+includedTeams[0]["points"]+")+1="+zielpunkte);
	}
  	document.getElementById("Zielpunkte").innerHTML = zielpunkte;
	if(zielpunkte>(((mdcount-tabelle[platz]["matches"])*3)+tabelle[platz]["points"])) document.getElementById("Zielpunkte").innerHTML += "*";
  	if(((mdcount-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"]<zielpunkte) { 
  		document.getElementById("ind_ziel_text").style.display = "block";
  		document.getElementById("ind_ziel").innerHTML = (((mdcount-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"]);
  	} else {
  		document.getElementById("ind_ziel_text").style.display = "none";
  	}

	var ta, tr, td;
	var ind_ziel = zielpunkte;

	let targettable = document.getElementById("mytable");
	while(targettable.rows.length > 1) {
		targettable.deleteRow(-1);
	}

	if (targettable) {
		ta = targettable;
		tabelle.forEach(function (m, i) {

			tr = ta.insertRow(i+1);

			if(i==platz) tr.setAttribute('style', 'border-top: solid black;');
			td = tr.insertCell(); td.innerHTML = i+1;
			td = tr.insertCell(); td.innerHTML = m["shortName"];
			td = tr.insertCell(); td.innerHTML = m["matches"];
			td = tr.insertCell(); td.innerHTML =  m["points"];

			td = tr.insertCell(); 

			if(i<platz && (((mdcount-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"])<zielpunkte) ind_ziel = ((mdcount-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"];
			else ind_ziel = zielpunkte;

			// check: i>platz+1: requires in addition the points in difference to platz?!
			td.innerHTML = ind_ziel;
			if(ind_ziel>(((mdcount-m["matches"])*3)+m["points"])) td.innerHTML += "*";

			if(debug) console.log("Target achievement feasible? "+ind_ziel+">"+(((mdcount-m["matches"])*3)+m["points"]));

			td = tr.insertCell(); 
			if(m["points"]>=ind_ziel) {
	    		td.innerHTML = "+";
	    	}
	    	td.innerHTML += m["points"]-ind_ziel;

			td = tr.insertCell(); 
			if(m["points"]>=ind_ziel) td.innerHTML += txt_erreicht;
			else if((ind_ziel-m["points"])>((mdcount-m["matches"])*3)) {
				if((tabelle[platz-1]["points"]-m["points"])<=((mdcount-m["matches"])*3)) td.innerHTML += txt_moeglich;
				else td.innerHTML += txt_verpasst;
	    	} else td.innerHTML += txt_offen;
		});
	}

	hideLoading();
}

function getMatches() {

	var openMatches = new XMLHttpRequest();
	openMatches.open("GET","https://api.openligadb.de/getmatchdata/"+league+"/"+saison);
	openMatches.setRequestHeader("accept","text/json");
	openMatches.addEventListener('load', function(event) {
	   if (openMatches.status >= 200 && openMatches.status < 300) {
	   		matches = JSON.parse(openMatches.responseText);
	   		buildTable();
	   } else {
	     	console.warn(openMatches.statusText, openMatches.responseText);
	     	hideLoading();
	   }
	});
	openMatches.addEventListener('error', hideLoading);
	openMatches.send();
	
}

function toggleDebug() {
	if(debug) {
		debug=false;
		league='bl1';
		saison=getCurrentSeason();
		document.getElementById("debug").setAttribute('style','display:none;');
	} else {
		debug=true;
		league='bl1';
		saison=2022;
		spieltag=0;
		document.getElementById("debug").setAttribute('style','display:block;');
	}
	viewMatchday = null;
	updateData(ziel);
}

// Recomputes the standings table as of `targetMatchday` by replaying every
// finished match with `groupOrderID <= targetMatchday` from the season's full
// match payload. Returns a new array shaped like the OpenLiga DB standings
// (only the fields buildTable touches: teamInfoId, teamName, shortName,
// matches, points; plus goals/goalDiff used for tiebreaker sorting).
// `referenceTabelle` provides the team roster + display names for the season.
function computeStandingsAtMatchday(allMatches, targetMatchday, referenceTabelle) {
	var teams = {};
	for (let i = 0; i < referenceTabelle.length; i++) {
		var ref = referenceTabelle[i];
		teams[ref["teamInfoId"]] = {
			teamInfoId: ref["teamInfoId"],
			teamName:   ref["teamName"],
			shortName:  ref["shortName"],
			teamIconUrl: ref["teamIconUrl"],
			points: 0, matches: 0, won: 0, draw: 0, lost: 0,
			goals: 0, opponentGoals: 0, goalDiff: 0
		};
	}
	for (let m = 0; m < allMatches.length; m++) {
		var match = allMatches[m];
		if (!match["group"] || match["group"]["groupOrderID"] > targetMatchday) continue;
		if (!match["matchIsFinished"]) continue;
		var results = match["matchResults"] || [];
		if (results.length === 0) continue;
		// Endergebnis = resultTypeID 2; fall back to the last entry for safety.
		var final = null;
		for (let r = 0; r < results.length; r++) {
			if (results[r]["resultTypeID"] === 2) { final = results[r]; break; }
		}
		if (!final) final = results[results.length - 1];
		var t1 = teams[match["team1"]["teamId"]];
		var t2 = teams[match["team2"]["teamId"]];
		if (!t1 || !t2) continue;
		var g1 = final["pointsTeam1"], g2 = final["pointsTeam2"];
		t1.matches++; t2.matches++;
		t1.goals += g1; t2.goals += g2;
		t1.opponentGoals += g2; t2.opponentGoals += g1;
		if (g1 > g2)      { t1.won++;  t2.lost++; t1.points += 3; }
		else if (g2 > g1) { t2.won++;  t1.lost++; t2.points += 3; }
		else              { t1.draw++; t2.draw++; t1.points++; t2.points++; }
	}
	var arr = [];
	for (var k in teams) {
		teams[k].goalDiff = teams[k].goals - teams[k].opponentGoals;
		arr.push(teams[k]);
	}
	// German football tiebreakers: points → goal difference → goals scored.
	arr.sort(function(a, b) {
		if (b.points   !== a.points)   return b.points   - a.points;
		if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
		return b.goals - a.goals;
	});
	return arr;
}

// Renders the matchday navigator (buttons 1..currentMatchday). The button for
// the current matchday equates to "live" and clears viewMatchday when chosen.
// Hidden in debug mode (the orange debug bar already serves that role) and
// when no matches have been played yet.
function renderMatchdayNav(currentMatchday) {
	var wrapper = document.getElementById("matchday-nav-wrapper");
	var nav = document.getElementById("matchday-nav");
	if (!wrapper || !nav) return;
	if (debug || currentMatchday < 1) {
		wrapper.style.display = "none";
		return;
	}
	nav.innerHTML = "";
	for (let n = 1; n <= currentMatchday; n++) {
		var btn = document.createElement("button");
		btn.className = "w3-button w3-small w3-border w3-round";
		btn.style.padding = "2px 8px";
		btn.style.minWidth = "34px";
		btn.textContent = n;
		var isActive = (viewMatchday === n) || (viewMatchday === null && n === currentMatchday);
		if (isActive) btn.className += " w3-teal";
		(function(md) { btn.onclick = function() { setViewMatchday(md); }; })(n);
		nav.appendChild(btn);
	}
	wrapper.style.display = "";
}

function setViewMatchday(n) {
	var currentMatchday = 0;
	for (let i = 0; i < liveTabelle.length; i++) {
		if (liveTabelle[i]["matches"] > currentMatchday) currentMatchday = liveTabelle[i]["matches"];
	}
	viewMatchday = (n >= currentMatchday) ? null : n;
	buildTable();
}

// Switch the active league. Preserves the currently selected goal (Saisonziel)
// so the user's selection persists across leagues. Debug mode is bound to the
// bl1 testdata files, so switching leagues exits debug mode automatically.
function setLeague(l) {
	if(!config[l] || l === league) return;
	if(debug) {
		debug = false;
		document.getElementById("debug").setAttribute('style','display:none;');
	}
	league = l;
	saison = getCurrentSeason();
	viewMatchday = null;
	updateData(ziel);
}

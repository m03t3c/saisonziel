
var saisonziel="ChampionsLeague";
var config = new Object();
config["bl1"] = new Object(); // 1. Bundesliga
config["bl1"]["league"] = 15; // corresponding to position 16 in the standings
config["bl1"]["int"] = 6; // corresponding to position 7 in the standings
config["bl1"]["cl"] = 4;// corresponding to position 16 in the standings
config["bl1"]["win"] = 1;

// debug mode - see data below
var debug = false;

var txt_erreicht = "<img src='icons/1.png' alt='Saisonziel erreicht'/>";
var txt_verpasst = "<img src='icons/4.png' alt='Saisonziel verpasst'/>";
var txt_moeglich = "<img src='icons/3.png' alt='Saisonziel nur rechnerisch noch möglich'/>";
var txt_offen = "<img src='icons/2.png' alt='Saisonziel noch erreichbar'/>";

var saison = 2023;
var league = "bl1";
var spiele_egal=0;
var platz = 15;
var spieltag=0;
var ziel;

var gotMatches = false;
var tabelle = [];
var matches = [];
var request = "";

// debug data
if(debug) {
	saison = 2022;
	spieltag = 30; // try 0, 10, 26, 30, 32, 33
	document.getElementById("debug").setAttribute('style','display:block;');
}


updateData(ziel);

function updateData(z="league") {
	ziel=z;
	if(!config[league]) league = "bl1";
	if(config[league][ziel]) platz = config[league][ziel];
	else platz = 15;
	console.log(league+"-"+ziel+"-"+platz+" config length:"+config[league].length);
	tabelle = [];
	spiele_egal=0;
	request = "";
	document.getElementById("zieltabelle").innerHTML="";

	// updating navigation bar
	var i, x, tablinks;
	tablinks = document.getElementsByClassName("tablink");
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(" w3-white", "");
		tablinks[i].className = tablinks[i].className.replace(" w3-red", "");
	}
	document.getElementById(ziel).className += " w3-white";
	if(debug) document.getElementById("debug"+spieltag).className += " w3-red";

	request = new XMLHttpRequest();
	
	if(debug) request.open("GET","testdata/data-2022-"+spieltag+".json");
	else request.open("GET","https://api.openligadb.de/getbltable/"+league+"/"+saison);
	request.setRequestHeader("accept","text/json");
	request.addEventListener('load', function(event) {
	   if (request.status >= 200 && request.status < 300) {
	    	//console.log(request.responseText);
			tabelle=JSON.parse(request.responseText);
		  	spieltag=tabelle[platz]["matches"];
		  	var punkte=tabelle[platz]["points"];
		  	// TODO: wieviele Spiele haben Platz 17 und 18 schon gegeneinander gemacht?
		  	var spiele_egal_mannschaften = new Array();
		  	/* for(let i=platz+1; i<tabelle.length; i++) {
		  		// console.log("Mannschaften egal "+i+". "+tabelle[i]["teamInfoId"]+" "+tabelle[i]["teamName"]);
		  		spiele_egal_mannschaften[i-platz-1] = new Object();
		  		spiele_egal_mannschaften[i-platz-1]["id"] = tabelle[i]["teamInfoId"];
		  		spiele_egal_mannschaften[i-platz-1]["mannschaft"] = tabelle[i]["teamName"];
		  		//console.log("Mannschaften egal "+i+". "+tabelle[i]["teamInfoId"]+" "+tabelle[i]["teamName"]);
		  	}
		  	getOpenMatches(spiele_egal_mannschaften, request);*/
		  	getMatches();
	     	// setTimeout(buildTable(request),20000);
	   } else {
	     	console.warn(request.statusText, request.responseText);
	   }
	});
	request.send();
}


function buildTable() {
	
	spieltag=tabelle[platz]["matches"];
	var punkte=tabelle[platz]["points"];

	// take secured qualifiers/disqualifiers out of the calculation
	var includedTeams = new Array();
	var countTeams = 0;
	for(let i = 0; i<tabelle.length; i++) {
		if((tabelle[i]["points"]<=((34-tabelle[platz]["matches"])*3)+tabelle[platz]["points"]) && (tabelle[platz-1]["points"]<=((34-tabelle[i]["matches"])*3)+tabelle[i]["points"])) { 
		// if my points do not qualify yet for the target after match 34 and if the target standing can still be obtained with my points after match 34 (is still in reach)
			tabelle[i]["standing"] = i;
			includedTeams.push(tabelle[i]);
			if(i<=platz) countTeams++;
			// console.log("included:"+tabelle[i]["teamName"]+"-"+tabelle[platz]["matches"]);
		}
	}
	var gamesCount=0;
	var gamesExcluded=0;
  	var diff_vorgaenger = 0; // var diff_vorgaenger = tabelle[platz-1]["points"]-tabelle[platz]["points"]; // Punkte zum Vorgänger (auf zu erreichendem Platz) müssen erst noch aufgeholt werden 
	for(let t1 =0; t1<includedTeams.length; t1++) {
		if(includedTeams[t1]["standing"] <= platz) diff_vorgaenger += includedTeams[0]["points"]-includedTeams[t1]["points"];
		//console.log("checking gamesCount"+t1+"-"+includedTeams[t1]["standing"]+"-"+includedTeams[t1]["teamName"]+"-"+(34-includedTeams[t1]["matches"])+" tot "+includedTeams.length);
		gamesCount += 34-includedTeams[t1]["matches"];
		for(let t2=0; t2<includedTeams.length; t2++) {
			//console.log("checking"+includedTeams[t1]["teamName"]+" and "+includedTeams[t2]["teamName"]);
			if(includedTeams[t1]["teamInfoId"]==includedTeams[t2]["teamInfoId"]) continue;
			for(let m=0; m<matches.length; m++) {
				
				if(matches[m]["team1"]["teamId"]==includedTeams[t1]["teamInfoId"] && matches[m]["team2"]["teamId"]==includedTeams[t2]["teamInfoId"] && matches[m]["group"]["groupOrderID"]>spieltag) {
					// TODO: vergleich mit spieltag hinkt bei nachholspielen (e.g. FCB-RBL). Besser Spieltagsdatum?!
					gamesExcluded++; // need to exclude amount of games against each other (only one team of one match can gain 3 points)
					// console.log("triggered regular exclusion: "+matches[m]["group"]["groupOrderID"]+". "+includedTeams[t1]["teamName"]+"-"+includedTeams[t2]["teamName"]+"-"+gamesExcluded);
					if(includedTeams[t1]["standing"]>platz && includedTeams[t2]["standing"]>platz) {
						gamesExcluded++; // games with teams "below the line" only should not count
						//console.log("triggered exclusion: "+platz+":"+includedTeams[t1]["teamName"]+"-"+includedTeams[t1]["standing"]+" and "+includedTeams[t2]["teamName"]+"-"+includedTeams[t2]["standing"]);
					}
				}
			}
		}
		// console.log("included:"+includedTeams[i]["teamName"]); // works
	}
	console.log("excluded: "+gamesExcluded+"-total:"+gamesCount+"-diff:"+diff_vorgaenger);
	// TODO: wie verhält es sich am Anfang der Saison? 34 Spiele mal 18 Teams = 612 Spiele? Durch 2?
	// wie viele werden abgezogen? vermutlich die hälfte, weil nur die Speilpaarung als "Excluded " gezählt wird
	// Müssen wir durch

	// Mannschaften, die das Ziel rechnerisch schon erreicht haben, müssen aus der Rechnung herausgenommen werden
	/*var removeTeams = 0;
	for(let i=0; i<tabelle.length; i++) {
		if(tabelle[i]["points"]-tabelle[platz]["points"]>(34-spieltag)*3) removeTeams++;
	}*/ // ersetzt durch gamesCount/includedTeams

  	// var zielpunkte=Math.floor(((((((34-spieltag)*9)-spiele_egal)*3)-diff_vorgaenger)/(platz+1))+punkte+diff_vorgaenger)+1; // Berechne wie viele Punkte noch vergeben werden und addiere wieviele der 16. schon erreicht hat
	var zielpunkte=Math.floor(((((gamesCount-gamesExcluded)*3)-diff_vorgaenger)/(countTeams))+includedTeams[0]["points"])+1; 
	/*if(zielpunkte>(tabelle[platz]["points"]+((34-spieltag)*3)+1)) {
		//zielpunkte = (tabelle[platz]["points"]+((34-spieltag)*3)+1);
		console.log("setting zielpunkte to "+zielpunkte+" due to calculatory difference (was "+(Math.floor(((((gamesCount-gamesExcluded)*3)-diff_vorgaenger)/(countTeams))+includedTeams[0]["points"])+1)+")");
	} // done via individual targets in table */
	console.log("Zielpunkte 1 gerundet:"+zielpunkte);
  	// TODO: alle Punkte über dem durchschnitt müssen von den noch erreichbaren abgezogen werden -- falsch; erreicht über diff_vorgaenger
  	/*var ueberschusspunkte=0;
  	for(let i=0; i<tabelle.length; i++) {
  		if(tabelle[i]["points"]>zielpunkte) ueberschusspunkte += tabelle[i]["points"]-zielpunkte;
  	}
  	console.log("Ueberschusspunkte abzuziehen:"+ueberschusspunkte);
  	zielpunkte=Math.ceil(((((((34-spieltag)*9)-spiele_egal)*3)-ueberschusspunkte)/(platz+1))+punkte);*/
  	// TODO: ausstehende Paarungen berücksichtigt
	console.log("Zielpunkte:"+((((((gamesCount-gamesExcluded)*3)-diff_vorgaenger)/(countTeams))+includedTeams[0]["points"])+1)+"; spieltag:"+spieltag+"; platz:"+platz+"; punkte "+(platz+1)+".:"+punkte);
	console.log("Zielpunkte gemittelt zu addieren:"+((((((gamesCount-gamesExcluded)*3)-diff_vorgaenger)/(countTeams)))));
	console.log("Zielpunkte gerundet:"+zielpunkte);
	console.log("Berechnung abgerunden(((((("+gamesCount+"-"+gamesExcluded+")*3)-"+diff_vorgaenger+")/("+(countTeams)+"))+"+includedTeams[0]["points"]+")+1");
  	// if(tabelle[platz-1]["points"]>zielpunkte) zielpunkte=tabelle[platz-1]["points"];
  	document.getElementById("Zielpunkte").innerHTML = zielpunkte;
	if(zielpunkte>(((34-tabelle[platz]["matches"])*3)+tabelle[platz]["points"])) document.getElementById("Zielpunkte").innerHTML += "*";

  	if(((34-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"]<zielpunkte) document.getElementById("ind_ziel").innerHTML = "Ansonsten gen&uuml;gen "+(((34-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"])+" Punkte.";

	let container = document.getElementById("zieltabelle"),
			ta, tr, td;
	var ind_ziel = zielpunkte;
	while (container.firstChild) {
		container.removeChild(container.firstChild);
	}

	if (container) {
		console.log("starting container");
		ta = container.appendChild(document.createElement("table"));
		ta.setAttribute('class', 'w3-table w3-striped w3-border w3-padding-small');
		ta.setAttribute('style', 'vertical-align:center;');
		tr = ta.insertRow(0);

		td = tr.insertCell(); td.outerHTML = "<th>Pl</th>";
		td = tr.insertCell(); td.outerHTML = "<th>Verein</th>";
		td = tr.insertCell(); td.outerHTML = "<th>Sp</th>";
		td = tr.insertCell(); td.outerHTML = "<th>Pk</th>";
		td = tr.insertCell(); td.outerHTML = "<th>Zi</th>";
		td = tr.insertCell(); td.outerHTML = "<th>Fhlnd</th>";
		td = tr.insertCell(); td.outerHTML = "<th>Status</th>";
		
		tabelle.forEach(function (m, i) {

			// let tr, td;

			tr = ta.insertRow(i+1);

			if(i==platz) tr.setAttribute('style', 'border-top: solid black;');
			td = tr.insertCell(); td.innerHTML = i+1;
			td = tr.insertCell(); td.innerHTML = m["teamName"];
			td = tr.insertCell(); td.innerHTML = m["matches"];
			td = tr.insertCell(); td.innerHTML =  m["points"];

			td = tr.insertCell(); 

			if(i<platz && (((34-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"])<zielpunkte) ind_ziel = ((34-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"];
			else ind_ziel = zielpunkte;
			td.innerHTML = ind_ziel;
			if(ind_ziel>(((34-m["matches"])*3)+m["points"])) td.innerHTML += "*";

			console.log("zielerreichbarkeit: "+ind_ziel+">"+(((34-m["matches"])*3)+m["points"]));

			td = tr.insertCell(); 
			if(m["points"]>=ind_ziel) {
	    		td.innerHTML = "+";
	    	}
	    	td.innerHTML += m["points"]-ind_ziel;

			td = tr.insertCell(); 
			if(m["points"]>=ind_ziel) td.innerHTML += txt_erreicht;
			else if((ind_ziel-m["points"])>((34-m["matches"])*3)) {
				if((tabelle[platz-1]["points"]-m["points"])<=((34-m["matches"])*3)) td.innerHTML += txt_moeglich;
				else td.innerHTML += txt_verpasst;
	    	} else td.innerHTML += txt_offen;
		});
	}

}

function getMatches() {

	var openMatches = new XMLHttpRequest();
	openMatches.open("GET","https://api.openligadb.de/getmatchdata/bl1/"+saison);
	// console.log("querying match data of "+m["mannschaft"]);
	openMatches.setRequestHeader("accept","text/json");
	openMatches.addEventListener('load', function(event) {
	   if (openMatches.status >= 200 && openMatches.status < 300) {
	    	// console.log(openMatches.responseText);

	     	/*JSON.parse(openMatches.responseText).forEach(function(s,j) {
	     		mannschaften.forEach(function(m2,i2) {
	     			if(i2!=i) {
		     			// console.log(m["id"]+":"+s["team1"]["teamName"]+s["team1"]["teamId"]+"-"+s["team2"]["teamName"]+s["team2"]["teamId"]+" "+s["matchIsFinished"]+" "+spiele_egal);
		     			
	    	 			if(s["team1"]["teamId"]==m["id"] && s["team2"]["teamId"]==m2["id"] && s["group"]["groupOrderID"]>spieltag) { 
	    	 				//console.log("Match found:"+s["team1"]["teamName"]+s["team1"]["teamId"]+"-"+s["team2"]["teamName"]+s["team2"]["teamId"]);
	    	 				spiele_egal++;
	     				} else {
	     					// console.log("looking for match:"+m["id"]+":"+s["team1"]["teamName"]+s["team1"]["teamId"]+"-"+s["team2"]["teamName"]+s["team2"]["teamId"]+" "+s["group"]["groupOrderID"]+" "+spiele_egal);
	     				}
	     			}
	     		});
	     	});
	     	madeCalls++;
	     	if(madeCalls==requiredCalls) buildTable(r); */
	   		matches = JSON.parse(openMatches.responseText);
	   		buildTable();
	     	
	     	// console.log("matches"+gotMatches+madeCalls+"-"+requiredCalls);
	   } else {
	     	console.warn(openMatches.statusText, openMatches.responseText);
	   }
	});
	openMatches.send();
	
}

function toggleDebug() {
	if(debug) { 
		debug=false;
		league='bl1'; 
		saison=2023; 
		document.getElementById("debug").setAttribute('style','display:none;');
	} else { 
		debug=true; 
		league='bl1'; 
		saison=2022; 
		spieltag=0;  
		document.getElementById("debug").setAttribute('style','display:block;');
	}
	updateData(ziel);
}
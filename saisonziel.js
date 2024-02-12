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

// debug data -- can be set via toggleDebug as well
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
	
	if(debug) console.log("updating Data for:\nLeague:"+league+".\ntarget:"+ziel+".\nstanding:"+platz+".\nconfig length:"+config[league].length);
	tabelle = [];
	spiele_egal=0;
	request = "";
	// document.getElementById("zieltabelle").innerHTML="";

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
	    				tabelle=JSON.parse(request.responseText);
		  	spieltag=tabelle[platz]["matches"];
		  	var punkte=tabelle[platz]["points"];
		  	var spiele_egal_mannschaften = new Array();
		  	getMatches();
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
		if(debug) console.log("checking gamesCount: team #"+t1+" position: "+includedTeams[t1]["standing"]+"; Team: "+includedTeams[t1]["teamName"]+" with "+(34-includedTeams[t1]["matches"])+" matches; out of "+includedTeams.length+" teams included.");
		gamesCount += 34-includedTeams[t1]["matches"];
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
	var zielpunkte=Math.floor(((((gamesCount-gamesExcluded)*3)-diff_vorgaenger)/(countTeams))+includedTeams[0]["points"])+1; 
	if(debug) { // some debugging output
		console.log("Target points rounded:"+zielpunkte);
	  	console.log("Target points calculatory (not rounded, not +1):"+((((((gamesCount-gamesExcluded)*3)-diff_vorgaenger)/(countTeams))+includedTeams[0]["points"]))+
	  		"\nmatch day#: "+spieltag+"\ntarget position:"+platz+"\npunkte: "+punkte);
		console.log("Zielpunkte gemittelt zu addieren:"+((((((gamesCount-gamesExcluded)*3)-diff_vorgaenger)/(countTeams)))));
		console.log("!!! Calculation: floor(((((("+gamesCount+"-"+gamesExcluded+")*3)-"+diff_vorgaenger+")/("+(countTeams)+"))+"+includedTeams[0]["points"]+")+1="+zielpunkte);
	}
  	document.getElementById("Zielpunkte").innerHTML = zielpunkte;
	if(zielpunkte>(((34-tabelle[platz]["matches"])*3)+tabelle[platz]["points"])) document.getElementById("Zielpunkte").innerHTML += "*";
  	if(((34-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"]<zielpunkte) { 
  		document.getElementById("ind_ziel_text").style.display = "block";
  		document.getElementById("ind_ziel").innerHTML = (((34-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"]);
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

			if(i<platz && (((34-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"])<zielpunkte) ind_ziel = ((34-tabelle[platz]["matches"])*3)+1+tabelle[platz]["points"];
			else ind_ziel = zielpunkte;

			// check: i>platz+1: requires in addition the points in difference to platz?!
			td.innerHTML = ind_ziel;
			if(ind_ziel>(((34-m["matches"])*3)+m["points"])) td.innerHTML += "*";

			if(debug) console.log("Target achievement feasible? "+ind_ziel+">"+(((34-m["matches"])*3)+m["points"]));

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
	openMatches.setRequestHeader("accept","text/json");
	openMatches.addEventListener('load', function(event) {
	   if (openMatches.status >= 200 && openMatches.status < 300) {
	   		matches = JSON.parse(openMatches.responseText);
	   		buildTable();
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

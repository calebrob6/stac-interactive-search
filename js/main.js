var queryGeneric = function(request){

    $.ajax({
        type: "POST",
        url: gSearchEndpoint,
        data: JSON.stringify(request),
        success: function(data, textStatus, jqXHR){


            gNumLoaded += data["features"].length;
            $("#lblNumLoaded").html(gNumLoaded);
            if ("context" in data){
                $("#lblNumMatched").html(data["context"]["matched"]);
            } else{
                $("#lblNumMatched").html("Unkown -- context extension not enabled");
            }


            visualizeResults(data);
            populateNext(data);
            $("#results").val(JSON.stringify(data));
        },
        fail: function(jqXHR, textStatus, errorThrown){
            console.log(jqXHR);
            console.log(textStatus);
            console.log(errorThrown);
        },
        dataType: "json"
    });
};

var queryGeom = function(geom){
    // TODO: We know which collection is selected so this can be replaced
    let collection = $("#collection-select option:selected").val();
    if(collection !== "---"){
        let request = {
            "intersects": geom,
            "datetime": gStartDate + "/" + gEndDate,
            "collections": [collection],
            "limit": gLimit
        }
        queryGeneric(request)
    }else{
        alert("Select a collection");
    }
};


var collectionSelectHandler = function(e){
    console.debug(this.value);
}

var getCollections = function(){

    let url = gEndpoint + "collections";

    $.ajax({
        type: "GET",
        url: url,
        success: function(data, textStatus, jqXHR){

            if("collections" in data){
                $("#collection-select").off("change");
                $("#collection-select").html("");

                data = data["collections"];

                let element = $('<option value="---">---</option>');
                $("#collection-select").append(element);

                for(var i=0;i<data.length;i++){
                    let element = $('<option value="'+data[i]["id"]+'">'+data[i]["title"]+'</option>');
                    $("#collection-select").append(element);
                    gCollections[data[i]["id"]] = data[i];
                }

                $("#collection-select").on("change", function(){
                    if(this.value !== "---"){
                        let data = gCollections[this.value];

                        let description = null;
                        if("msft:short_description" in data){
                            description = data["msft:short_description"];
                        }else{
                            description = data["description"];
                        }
                        let timeStart = data["extent"]["temporal"]["interval"][0][0];
                        let timeEnd = data["extent"]["temporal"]["interval"][0][1];

                        timeStart = timeStart === null ? "undefined" : timeStart.substring(0,10);
                        timeEnd = timeEnd === null ? "undefined" : timeEnd.substring(0,10);

                        $("#lblCollectionDescription").html(description);
                        $("#lblTemporalRange").html(timeStart + " -- " + timeEnd);
                    }else{
                        $("#lblCollectionDescription").html("");
                        $("#lblTemporalRange").html("");
                    }
                })
            }else{
                alert("INVALID RESPONSE");
            }
        },
        fail: function(jqXHR, textStatus, errorThrown){
            console.log(jqXHR);
            console.log(textStatus);
            console.log(errorThrown);
        },
        dataType: "json"
    });
};

var isValidURL = function(string){
    // https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
    let url;
    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
};

var changeLblCollectionStatus = function(valid){
    if(valid){
        $("#lblEndpointStatus").addClass("green");
        $("#lblEndpointStatus").removeClass("red");
        $("#lblEndpointStatus").children().addClass("fa-check");
        $("#lblEndpointStatus").children().removeClass("fa-times");
    }else{
        $("#lblEndpointStatus").addClass("red");
        $("#lblEndpointStatus").removeClass("green");
        $("#lblEndpointStatus").children().addClass("fa-times");
        $("#lblEndpointStatus").children().removeClass("fa-check");
    }
};

var isSTACCollectionUrl = async function(url){

    if (isValidURL(url)){
        try {
            let result = await $.ajax({
                type: "GET",
                url: url,
                dataType: "json"
            });
            return "stac_version" in result;
        } catch(error){
            return false;
        }
    } else{
        return false;
    }
};

var clearResults = function(){
    gFeatureGroup.clearLayers();
    gTileLayers.clearLayers();
    $("#results").val("");
    $("#lblNumMatched").html("-");
    $("#lblNumLoaded").html("-")
    $("#resultsList").html("");
    gNumLoaded = 0;
};


var renderTileJSON = function(url){
    $.ajax({
        type: "GET",
        url: url,
        dataType: "json",
        success: function (tileJson) {

            clearResults();
            if(gSelection !== null){
                gSelection.remove();
                gSelection = null;
            }

            console.debug(tileJson)

            let minx = tileJson.bounds[0];
            let miny = tileJson.bounds[1];
            let maxx = tileJson.bounds[2];
            let maxy = tileJson.bounds[3];
            let bounds = [[miny, minx],[maxy, maxx]]

            var tiles = tileJson.tiles[0];

            var tileLayer = L.tileLayer(tiles, {
                minZoom: tileJson.minzoon,
                maxZoom: tileJson.maxzoom,
                bounds: bounds,
            }).addTo(gMap);

            gTileLayers.addLayer(tileLayer)
            gMap.fitBounds(bounds);
        }
    });
}


var featurePopup = function(layer){
    //called on a feature click
    let feature = layer.feature;
    let content = document.createElement("div")
    content.appendChild($("<b>" + feature.id + "</b>")[0]);
    let list = document.createElement("ul");
    for(k in feature.assets){
        let url = feature.assets[k]["href"];
        let listElement = document.createElement("li");
        let linkElement = document.createElement("a");
        linkElement.href = "#"
        linkElement.innerHTML = k;
        $(linkElement).click(function(){
            let hrefResult = signURL(url);
            hrefResult.then(function(result){
                window.open(result, '_blank');
            });
        })
        listElement.appendChild(linkElement)

        list.appendChild(listElement);
    }
    content.appendChild(list);
    return content;
};

var signURL = async function(url){
    try{
        let result = await $.ajax({
            type: "GET",
            url: "https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=" + url,
            dataType: "json"
        });
        return result["href"];
    }catch{ // the signing failed, so use the URL we were trying to sign
        return url;
    }
}

var parseURL = async function(url){
    if (gEndpoint.indexOf("planetarycomputer") != -1){
        let result = await signURL(url);
        return result;
    }else{
        return url;
    }
}

var visualizeResults = function(data){
    // Called after a successful API search request
    let features = data["features"];
    for(let i=0; i<features.length; i++){

        let geoJSON = features[i];
        //console.debug(geoJSON);
        let feature = L.geoJSON(geoJSON,{
            style: {
                "color": "#4573ff",
                "weight": 1,
                "opacity": 0.2
            }
        });

        gFeatureGroup.addLayer(feature);
        feature.bindPopup(featurePopup, {
            maxWidth: 700
        });


        let content = document.createElement("li");
        let assetImage = document.createElement("img");
        if("thumbnail" in geoJSON.assets){ // I assume that these will always be PNG or JPEG
            let hrefResult = parseURL(geoJSON.assets.thumbnail["href"]);
            hrefResult.then(function(result){
                assetImage.src = result;
            });
        }else if("rendered_preview" in geoJSON.assets){ // Special case for the planetary computer
            assetImage.src = geoJSON.assets.rendered_preview["href"];
        }else{
            // This happens when there is no preview image
        }
        assetImage.classList.add("asset-thumbnail");

        let assetInfo = document.createElement("div");
        assetInfo.classList.add("asset-info");

        let assetName = document.createElement("div");
        assetName.innerHTML = geoJSON.id
        assetInfo.appendChild(assetName);

        let assetDate = document.createElement("div");
        assetDate.innerHTML = geoJSON.properties.datetime;
        assetInfo.appendChild(assetDate);

        if("tilejson" in geoJSON.assets){
            let assetRender = $("<button data-url='"+geoJSON.assets.tilejson["href"]+"'>Render</button>");
            assetRender.on("click", function(){

                let url = $(this).data("url");
                renderTileJSON(url, feature);
                return false;
            })
            assetInfo.appendChild(assetRender[0]);
        }

        content.appendChild(assetImage);
        content.appendChild(assetInfo);
        document.getElementById("resultsList").appendChild(content);

        $(content).click(function(){
            feature.openPopup();
        })

    }
};

var populateNext = function(data){
    // Called after a successful API search request
    if(data["links"].length > 0){
        let links = data["links"];
        let foundNext = false;
        for(let i=0; i<links.length; i++){
            if(links[i]["rel"] === "next"){
                let request = links[i]["body"];
                $("#btnNext").prop("disabled", false);
                gNextRequest = request;
                foundNext = true;
            }
        }
        if(!foundNext){
            console.debug("Reached the end of the data")
            $("#btnNext").prop( "disabled", true);
        }
    }else{
        console.debug("Reached the end of the data")
        $("#btnNext").prop( "disabled", true);
    }
};

var processNewEndpoint = async function(url){
    let validUrl = await isSTACCollectionUrl(url);
    if(validUrl){
        changeLblCollectionStatus(true);
        gEndpoint = url;
        if(!gEndpoint.endsWith("/")){
            gEndpoint += "/";
        }
        gSearchEndpoint = gEndpoint + "search"

        gCollections = Object(); // clear out the existing collections objects
        clearResults(); // clear out the existing map results

        getCollections();
    }else{
        changeLblCollectionStatus(false);
    }
}
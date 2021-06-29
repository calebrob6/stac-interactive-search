var queryGeneric = function(request){

    $.ajax({
        type: "POST",
        url: gSearchEndpoint,
        data: JSON.stringify(request),
        success: function(data, textStatus, jqXHR){

            gNumLoaded += data["context"]["returned"];

            $("#lblNumMatched").html(data["context"]["matched"]);
            $("#lblNumLoaded").html(gNumLoaded);

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

    let collection = $("#collection-select option:selected").val();
    let request = {
        "intersects": geom,
        "datetime": gStartDate + "/" + gEndDate,
        "collections": [collection],
        "limit": gLimit
    }
    queryGeneric(request)
};

var getCollections = function(){

    let url = gEndpoint + "collections";

    $.ajax({
        type: "GET",
        url: url,
        success: function(data, textStatus, jqXHR){
            $("#collection-select").html("");
            if("collections" in data){
                data = data["collections"];
                for(var i=0;i<data.length;i++){
                    $("#collection-select").append('<option value="'+data[i]["id"]+'">'+data[i]["title"]+'</option>')
                }
            }else{
                for(var i=0;i<data.length;i++){
                    $("#collection-select").append('<option value="'+data[i]["id"]+'">'+data[i]["title"]+'</option>')
                }
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
    $("#results").val("");
    $("#lblNumMatched").html("-");
    $("#lblNumLoaded").html("-")
    $("#resultsList").html("");
    gNumLoaded = 0;
}

var featurePopup = function(layer){
    //called on a feature click
    let feature = layer.feature;
    let content = document.createElement("div")
    content.appendChild($("<b>" + feature.id + "</b>")[0]);
    let list = document.createElement("ul");
    let numAssets = Object.keys(feature.assets).length;
    console.debug(numAssets);
    for(k in feature.assets){
        let hrefResult = parseURL(feature.assets[k]["href"]);
        let listElement = document.createElement("li");
        let linkElement = document.createElement("a");
        linkElement.target = "_blank";
        linkElement.innerHTML = k;
        listElement.appendChild(linkElement)
        hrefResult.then(function(result){
            linkElement.href = result;
        });
        list.appendChild(listElement);
    }
    content.appendChild(list);
    return content;
};

var signURL = async function(url){
    // TODO: try catch for cases where we are rate limited
    let result = await $.ajax({
        type: "GET",
        url: "https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=" + url,
        dataType: "json"
    });
    return result["href"];
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
        }else if("preview" in geoJSON.assets){ // I assume that these will always be TIFF
            // TODO
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

        getCollections();
    }else{
        changeLblCollectionStatus(false);
    }
}
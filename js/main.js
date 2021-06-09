var queryGeneric = function(request){

    $.ajax({
        type: "POST",
        url: gSearchEndpoint,
        data: JSON.stringify(request),
        success: function(data, textStatus, jqXHR){
            $("#lblNumMatched").html(data["context"]["matched"]);
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
}

var featurePopup = function(layer){
    console.debug(layer);
    let feature = layer.feature;
    let content = document.createElement("div")
    content.appendChild($("<b>" + feature.id + "</b>")[0]);
    let list = document.createElement("ul");
    for(k in feature.assets){
        console.debug(feature.assets[k]);
        let href = feature.assets[k]["href"];
        let element = $("<li><a href='"+href+"' target='_blank'>"+k+"</a></li>")[0];
        list.appendChild(element);
    }
    content.appendChild(list);
    return content;
};

var visualizeResults = function(data){
    // Called after a successful API search request
    let features = data["features"];
    for(let i=0; i<features.length; i++){

        let geoJSON = features[i];
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
                $("#btnNext").prop( "disabled", false);
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
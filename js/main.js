
var isValidURL = function(string){
    // https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
    let url;
    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
}

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
}

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
            console.log(error);
            return false;
        }
    } else{
        return false;
    }
}
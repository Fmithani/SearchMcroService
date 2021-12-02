const AWS = require("aws-sdk");
const config = require("../config/config");
const tables = require("../config/tables");
const { v4: uuidv4 } = require("uuid");
const { Response } = require("../config/Util");
const MESSAGE = require("../config/messages");

const LRU = require("lru-cache");

const isDev = process.env.NODE_ENV !== "production";

const s3Client = new AWS.S3({
  accessKeyId: config.awsAccesskeyID,
  secretAccessKey: config.awsSecretAccessKey,
  region: config.awsRegion,
});

const uploadParams = {
  Bucket: process.env.BUCKET_S3,
  Key: "", // pass key
  Body: null, // pass file body
};

// const s3 = {};
// s3.s3Client = s3Client;
// s3.uploadParams = uploadParams;

const cache = new LRU({
  maxAge: 0,
  max: 500000000000,
  length: (label) => {
    return label.length * 100;
  },
});

function compareObjects(object1, object2, key) {
  const obj1 = object1["labels"][key].Confidance;
  const obj2 = object2["labels"][key].Confidance;

  if (obj1 > obj2) {
    return -1;
  }
  if (obj1 < obj2) {
    return 1;
  }
  return 0;
}

// Get a image search by label
exports.getSearchResult = async (req, res, next) => {
  if (isDev) {
    AWS.config.update(config.aws_local_config);
  } else {
    AWS.config.update(config.aws_remote_config);
  }
  let label = req.query.label;
  // Find in cache
  let getItemFromCache = cache.get(label);
  if (getItemFromCache && getItemFromCache !== undefined) {
    return Response(res, true, MESSAGE.RECORD_RETRIVED, getItemFromCache);
  } else {
    // Find in DB
    const docClient = new AWS.DynamoDB.DocumentClient();
    const params = {
      TableName: tables.IMAGES,
      FilterExpression: "attribute_exists(#key.#keyval)",
      ExpressionAttributeNames: {
        "#key":"labels",
        "#keyval":label
      }
    };

    docClient.scan(params, function (err, data) {
      if (err) {
        return Response(res, false, MESSAGE.RECORD_NOT_RETRIVED, err);
      } else {
        const { Items } = data;
        for (let i = 0; i < Items.length; i++) {
          if (Items[i].file_name !== undefined)
            Items[i].url = config.awsS3BaseUrl + "" + Items[i].file_name ?? "";
            Items[i].search_label = label;
        }
        Items.sort((item1, item2) => {
          return compareObjects(item1, item2, label);
        });

        cache.set(label, Items);
        return Response(res, true, MESSAGE.RECORD_RETRIVED, Items);
      }
    });
  }
};

/**
Art name: test image 
Price : 2000
Destiantion: location of the art 
Related Tags: can be empty 
related arts: can be empty 
Title : test image
Artist: artist name 
Dimensions: 12×13 
Medium: canvas , paper 
Description: test discruption
tags: any random dags
 */
exports.getFilterResults = async (req, res, next) => {
  if (isDev) {
    AWS.config.update(config.aws_local_config);
  } else {
    AWS.config.update(config.aws_remote_config);
  }

  let _body = req.body;
  let _label = _body.label;
  // Find in cache
  // let getItemFromCache = cache.get(_label);
  // if (getItemFromCache && getItemFromCache !== undefined) {
  //   return Response(res, true, MESSAGE.RECORD_RETRIVED, getItemFromCache);
  // } else {
    let _filter_expression = "";
    let _attribute_field = { };
    let _attribute_value = { };

    if (_body.art_name != undefined) {
        _filter_expression = _filter_expression + ' and contains (#f_art_name, :v_art_name) ';
        _attribute_field["#f_art_name"] = "art_name";
        _attribute_value[":v_art_name"] = _body.art_name;
    }

    if (_body.description != undefined) {
      _filter_expression = _filter_expression + ' and contains (#f_description, :v_description) ';
      _attribute_field["#f_description"] = "description";
      _attribute_value[":v_description"] = _body.description;
    }

    if (_body.title != undefined) {
        _filter_expression = _filter_expression + ' and contains (#f_title, :v_title) ';
        _attribute_field["#f_title"] = "title";
        _attribute_value[":v_title"] = _body.title;
    }

    if (_body.artist != undefined) {
      _filter_expression = _filter_expression + ' and contains (#f_artist, :v_artist) ';
      _attribute_field["#f_artist"] = "artist";
      _attribute_value[":v_artist"] = _body.artist;
    }

    if (_body.destination != undefined) {
      _filter_expression = _filter_expression + ' and contains (#f_destination, :v_destination) ';
      _attribute_field["#f_destination"] = "destination";
      _attribute_value[":v_destination"] = _body.destination;
    }

    if (_body.price != undefined) {
      let _min_price = _body.price.min;
      let _max_price = _body.price.max;

      if (_min_price != undefined) {
        _filter_expression = _filter_expression + ' and #f_price_min <= :v_price_min ';
        _attribute_field["#f_price_min"] = "price";
        _attribute_value[":v_price_min"] = _min_price;
      }

      if (_max_price != undefined) 
      {  
        _filter_expression = _filter_expression + ' and #f_price_max >= :v_price_max ';
        _attribute_field["#f_price_max"] = "price";
        _attribute_value[":v_price_max"] = _max_price;
      }
      
    }

    console.log('filter => ', _filter_expression, _attribute_field, _attribute_value);

    const docClient = new AWS.DynamoDB.DocumentClient();
    const params = {
      TableName: tables.IMAGES,
      FilterExpression: "(attribute_exists(labels." + _label + ") ) " + _filter_expression ,
    };

    if (_filter_expression.length > 0)
    {
      params.ExpressionAttributeNames = _attribute_field;
      params.ExpressionAttributeValues = _attribute_value;
    }

    docClient.scan(params, function (err, data) {
      if (err) {
        return Response(res, false, MESSAGE.RECORD_NOT_RETRIVED, err);
      } else {
        const { Items } = data;
        // for (let i = 0; i < Items.length; i++) {
        //   if (Items[i].file_name !== undefined)
        //     Items[i].url = config.awsS3BaseUrl + "" + Items[i].file_name ?? "";
        // }
        // Items.sort((item1, item2) => {
        //   return compareObjects(item1, item2, _label);
        // });

        // cache.set(_label, Items);
        return Response(res, true, MESSAGE.RECORD_RETRIVED, Items);
      }
    });

  // }
};

"use strict";

const search = require("../controller/search.controller");

const express = require("express");
const router = express.Router();

const cors = require("cors");
const app = express();

app.use(cors());

router.get("/api/search", search.getSearchResult);

module.exports = router;

#!/bin/bash

curl 'http://skeeto.s3.amazonaws.com/share/JEOPARDY_QUESTIONS1.json.gz' \
  | gzip -d > './res/JEOPARDY_QUESTIONS1.json'

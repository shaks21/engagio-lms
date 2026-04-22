#!/bin/bash
cd /home/shaks/engagio-lms/web
export NODE_ENV=production
npx next start -p 3001 -h 0.0.0.0

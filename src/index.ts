#!/usr/bin/env node

import * as Dotenv from 'dotenv';
import Genesis from './Genesis';

Dotenv.config();
Genesis.requestContainers();

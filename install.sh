#!/bin/bash

echo "Installing Homebrew..."
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
brew update
brew doctor

echo "Installing ino..."
brew install ino

echo "Installing node.js..."
brew install node

echo "Installing node dependencies..."
npm install
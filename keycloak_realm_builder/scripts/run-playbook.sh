#!/bin/bash
ansible-playbook playbook.yml -e repo_url=$1 -e branch=$2 -e pull_request_number=$3 \
-e repo_owner=$4 -e pull_request_url=$5 -e issue_url=$6 -e label_name=$7  \
-e gh_token=$TOKEN

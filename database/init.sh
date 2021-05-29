set -xe
set -o pipefail

CURRENT_DIR=$(cd $(dirname $0);pwd)
export MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
export MYSQL_PORT=${MYSQL_PORT:-3306}
export MYSQL_USER=${MYSQL_USER:-asi}
export MYSQL_DBNAME=${MYSQL_DBNAME:-asi}
export MYSQL_PASSWD=${MYSQL_PASSWD:-asi}
export LANG="C.UTF-8"
cd $CURRENT_DIR

cat initial.sql | mysql --defaults-file=/dev/null -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER $MYSQL_DBNAME

#!/bin/sh
### BEGIN INIT INFO
# Provides:          dbmd-httpd
# Required-Start:    $remote_fs
# Required-Stop:     $remote_fs
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: dbmd HTTP server
# Description:       dbmd HTTP server
### END INIT INFO
#
# Installation:
#   1. Put a copy of or make a symlink to this script in /etc/init.d
#   2. update-rc.d dbmd-httpd defaults
#
# Do NOT "set -e"

# PATH should only include /usr/* if it runs after the mountnfs.sh script
PATH=/sbin:/usr/sbin:/bin:/usr/bin:/usr/local/bin
NAME=dbmd-httpd
DESC="dbmd HTTP server"
RUNDIR=/var/run/dbmd
LOGDIR=/var/log/dbmd
SCRIPTNAME=/etc/init.d/$NAME
USER=www-data
GROUP=www-data
#RELOAD_SIGNAL=1

# Node.js
NODE_PROGRAM=/usr/local/bin/node
NODE_SCRIPT=/var/dbmd/bin/dbmd.js
NODE_ARGS="$NODE_PROGRAM"

# Daemon supervisor config
SUPERVISOR=/usr/bin/daemon
SUPERVISOR_ARGS="--respawn --delay=30" # do NOT set "--user" here
SUPERVISOR_PIDDIR="$RUNDIR"
PIDFILE="$SUPERVISOR_PIDDIR/$NAME.pid"

# ----- end of configuration -----

# Exit if the package is not available
test -f "$NODE_SCRIPT" || exit 0

# Read configuration variable file if it is present
[ -r /etc/default/$NAME ] && . /etc/default/$NAME

# Load the VERBOSE setting and other rcS variables
. /lib/init/vars.sh

# Define LSB log_* functions.
# Depend on lsb-base (>= 3.0-6) to ensure that this file is present.
. /lib/lsb/init-functions

# Make sure run and log directories exist
mkdir -p $RUNDIR > /dev/null 2> /dev/null
chown -R $USER:$GROUP $RUNDIR
chmod 0750 $RUNDIR
mkdir -p $LOGDIR > /dev/null 2> /dev/null
chown -R $USER:$GROUP $LOGDIR
chmod 0750 $LOGDIR

VERBOSE=yes

do_start() {
  # Return
  #   0 if daemon has been started
  #   1 if daemon was already running
  #   2 if daemon could not be started
  [ "$VERBOSE" != no ] && log_daemon_msg "starting $NAME"
  start-stop-daemon --start --quiet --pidfile $PIDFILE \
                    --exec $SUPERVISOR --test > /dev/null
  STATUS="$?"
  if [ "$STATUS" = "0" ]; then
    start-stop-daemon --start --quiet --pidfile $PIDFILE \
                      --exec $SUPERVISOR --chuid $USER:$GROUP -- \
                      $SUPERVISOR_ARGS \
                      --name=$NAME --pidfile=$PIDFILE \
                      --stdout=$LOGDIR/$NAME.log \
                      --stderr=$LOGDIR/$NAME.log \
                      --errlog=$LOGDIR/$NAME.err \
                      -- "$NODE_PROGRAM" $NODE_ARGS
    STATUS="$?"
  else
    STATUS=2
  fi
  case "$STATUS" in
    0|1) [ "$VERBOSE" != no ] && log_end_msg 0 ;;
    2) [ "$VERBOSE" != no ] && log_end_msg 1 ;;
  esac
  return $STATUS
}

do_stop() {
  # Return
  #   0 if daemon has been stopped
  #   1 if daemon was already stopped
  #   2 if daemon could not be stopped
  #   other if a failure occurred
  [ "$VERBOSE" != no ] && log_daemon_msg "stopping $NAME"
  start-stop-daemon --stop --quiet --retry=TERM/30/KILL/5 --pidfile $PIDFILE
  STATUS="$?"
  case "$STATUS" in
    0|1) [ "$VERBOSE" != no ] && log_end_msg 0 ;;
    2) [ "$VERBOSE" != no ] && log_end_msg 1 ;;
  esac
  if [ "$STATUS" != "2" ]; then
    rm -f $PIDFILE
  fi
  return $STATUS
}

do_restart() {
  do_stop
  do_start || return $?
  return 0
}

do_reload() {
  [ "$VERBOSE" != no ] && log_daemon_msg "reloading $NAME"
  kill -s $RELOAD_SIGNAL $(cat $PIDFILE)
  case "$?" in
    0) [ "$VERBOSE" != no ] && log_end_msg 0 ;;
    *) [ "$VERBOSE" != no ] && log_end_msg 1 ;;
  esac
  return $?
}

usage() {
  if [ "$RELOAD_SIGNAL" != "" ]; then
    echo "Usage: $SCRIPTNAME {start|stop|restart|reload|force-reload}" >&2
  else
    echo "Usage: $SCRIPTNAME {start|stop|restart|force-reload}" >&2
  fi
}

case "$1" in
  start)
    do_start
    ;;
  stop)
    do_stop
    ;;
  restart|force-reload)
    do_restart
    ;;
  reload)
    if [ "$RELOAD_SIGNAL" != "" ]; then
      do_reload
    else
      usage
      exit 3
    fi
    ;;
  *)
    usage
    exit 3
    ;;
esac

:

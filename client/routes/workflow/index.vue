<script>
// Copyright (c) 2017-2021 Uber Technologies Inc.
// Portions of the Software are attributed to Copyright (c) 2020 Temporal Technologies Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import { RETRY_COUNT_MAX, RETRY_TIMEOUT } from './constants';
import {
  getHistoryEvents,
  getHistoryTimelineEvents,
  getSummary,
} from './helpers';
import { NOTIFICATION_TYPE_ERROR } from '~constants';
import { getErrorMessage } from '~helpers';
import { NavigationBar, NavigationLink } from '~components';

export default {
  data() {
    return {
      baseApiUrlRetryCount: 0,
      events: [],
      isWorkflowRunning: undefined,
      nextPageToken: undefined,
      fetchHistoryPageRetryCount: 0,
      wfLoading: true,
      workflow: undefined,

      history: {
        loading: undefined,
      },

      summary: {
        input: undefined,
        isWorkflowRunning: undefined,
        parentWorkflowRoute: undefined,
        result: undefined,
        wfStatus: undefined,
        workflow: undefined,
      },

      taskList: {},

      unwatch: [],
    };
  },
  props: [
    'dateFormat',
    'domain',
    'runId',
    'timeFormat',
    'timezone',
    'workflowHistoryEventHighlightList',
    'workflowHistoryEventHighlightListEnabled',
    'workflowId',
  ],
  created() {
    this.unwatch.push(
      this.$watch('baseAPIURL', this.onBaseApiUrlChange, { immediate: true })
    );
  },
  beforeDestroy() {
    this.clearWatches();
  },
  components: {
    'navigation-bar': NavigationBar,
    'navigation-link': NavigationLink,
  },
  computed: {
    baseAPIURL() {
      const { domain, workflowId, runId } = this;

      return `/api/domains/${domain}/workflows/${workflowId}/${runId}`;
    },
    historyEvents() {
      const {
        dateFormat,
        events,
        timeFormat,
        timezone,
        workflowHistoryEventHighlightList,
        workflowHistoryEventHighlightListEnabled,
      } = this;

      return getHistoryEvents({
        dateFormat,
        events,
        timeFormat,
        timezone,
        workflowHistoryEventHighlightList,
        workflowHistoryEventHighlightListEnabled,
      });
    },
    historyTimelineEvents() {
      const { historyEvents } = this;

      return getHistoryTimelineEvents({ historyEvents });
    },
    historyUrl() {
      const historyUrl = `${this.baseAPIURL}/history?waitForNewEvent=true`;

      if (!this.nextPageToken) {
        return historyUrl;
      }

      return `${historyUrl}&nextPageToken=${encodeURIComponent(
        this.nextPageToken
      )}`;
    },
    isWorkerRunning() {
      return this.taskList.pollers && this.taskList.pollers.length > 0;
    },
  },
  methods: {
    clearState() {
      this.events = [];
      this.isWorkflowRunning = undefined;
      this.nextPageToken = undefined;
      this.fetchHistoryPageRetryCount = 0;
      this.wfLoading = true;
      this.workflow = undefined;

      this.history.loading = undefined;

      this.summary.input = undefined;
      this.summary.isWorkflowRunning = undefined;
      this.summary.parentWorkflowRoute = undefined;
      this.summary.result = undefined;
      this.summary.wfStatus = undefined;
      this.summary.workflow = undefined;
    },
    clearWatches() {
      while (this.unwatch.length) {
        this.unwatch.pop()();
      }
    },
    clearHistoryUrlWatch() {
      while (this.unwatch.length > 1) {
        this.unwatch.pop()();
      }
    },
    fetchHistoryPage(pagedHistoryUrl) {
      if (
        !pagedHistoryUrl ||
        this.fetchHistoryPageRetryCount >= RETRY_COUNT_MAX
      ) {
        this.history.loading = false;

        return Promise.resolve();
      }

      this.history.loading = true;
      this.pqu = pagedHistoryUrl;

      return this.$http(pagedHistoryUrl)
        .then(res => {
          // eslint-disable-next-line no-underscore-dangle
          if (this._isDestroyed || this.pqu !== pagedHistoryUrl) {
            return null;
          }

          if (res.nextPageToken && this.npt === res.nextPageToken) {
            // nothing happened, and same query is still valid, so let's long pool again
            return this.fetch(pagedHistoryUrl);
          }

          if (res.nextPageToken) {
            this.isWorkflowRunning = JSON.parse(
              atob(res.nextPageToken)
            ).IsWorkflowRunning;
            setTimeout(() => {
              this.nextPageToken = res.nextPageToken;
            });
          } else {
            this.isWorkflowRunning = false;
          }

          const shouldHighlightEventId =
            this.$route.query.eventId &&
            this.events.length <= this.$route.query.eventId;

          const { events } = res.history;

          this.events = this.events.concat(events);

          this.summary = getSummary({
            events: this.events,
            isWorkflowRunning: this.isWorkflowRunning,
            workflow: this.workflow,
          });

          if (shouldHighlightEventId) {
            this.$emit('highlight-event-id', this.$route.query.eventId);
          }

          this.fetchHistoryPageRetryCount = 0;

          return this.events;
        })
        .catch(error => {
          // eslint-disable-next-line no-console
          console.error(error);

          // eslint-disable-next-line no-underscore-dangle
          if (this._isDestroyed || this.pqu !== pagedHistoryUrl) {
            return;
          }

          this.$emit('onNotification', {
            message: getErrorMessage(error),
            type: NOTIFICATION_TYPE_ERROR,
          });

          this.fetchHistoryPageRetryCount += 1;
          setTimeout(
            () => this.fetchHistoryPage(pagedHistoryUrl),
            RETRY_TIMEOUT
          );
        })
        .finally(() => {
          // eslint-disable-next-line no-underscore-dangle
          if (this._isDestroyed || this.pqu !== pagedHistoryUrl) {
            this.history.loading = false;
          }
        });
    },
    onBaseApiUrlChange(baseAPIURL) {
      if (this.baseApiUrlRetryCount >= RETRY_COUNT_MAX) {
        return;
      }

      this.clearHistoryUrlWatch();
      this.clearState();
      this.wfLoading = true;

      return this.$http(baseAPIURL)
        .then(
          wf => {
            this.workflow = wf;
            this.isWorkflowRunning = !wf.workflowExecutionInfo.closeTime;
            this.setupHistoryUrlWatch();
            this.baseApiUrlRetryCount = 0;
          },
          error => {
            this.$emit('onNotification', {
              message: getErrorMessage(error),
              type: NOTIFICATION_TYPE_ERROR,
            });
            this.baseApiUrlRetryCount += 1;
            setTimeout(
              () => this.onBaseApiUrlChange(baseAPIURL),
              RETRY_TIMEOUT
            );
          }
        )
        .finally(() => {
          this.wfLoading = false;
        });
    },
    onHistoryUrlChange(historyUrl) {
      this.fetchHistoryPage(historyUrl).then(this.fetchTaskList);
    },
    onNotification(event) {
      this.$emit('onNotification', event);
    },
    onWorkflowHistoryEventParamToggle(event) {
      this.$emit('onWorkflowHistoryEventParamToggle', event);
    },
    setupHistoryUrlWatch() {
      this.clearHistoryUrlWatch();
      this.unwatch.push(
        this.$watch('historyUrl', this.onHistoryUrlChange, { immediate: true })
      );
    },
    fetchTaskList() {
      if (!this.workflow || !this.workflow.executionConfiguration) {
        return Promise.reject('task list name is required');
      }

      const taskListName = this.workflow.executionConfiguration.taskList.name;

      this.$http(
        `/api/domains/${this.$route.params.domain}/task-lists/${taskListName}`
      )
        .then(
          taskList => {
            this.taskList = { name: taskListName, ...taskList };
          },
          error => {
            this.taskList = { name: taskListName };
            this.error =
              (error.json && error.json.message) ||
              error.status ||
              error.message;
          }
        )
        .finally(() => {
          this.loading = false;
        });
    },
  },
};
</script>

<template>
  <section class="execution" :class="{ loading: wfLoading }">
    <navigation-bar>
      <navigation-link
        id="nav-link-summary"
        icon="icon_receipt"
        label="Summary"
        :to="{ name: 'workflow/summary' }"
        data-cy="summary-link"
      />
      <navigation-link
        id="nav-link-history"
        icon="icon_trip-history"
        label="History"
        :to="{ name: 'workflow/history' }"
        data-cy="history-link"
      />
      <navigation-link
        id="nav-link-stack-trace"
        icon="icon_trips"
        label="Stack Trace"
        :to="{ name: 'workflow/stack-trace' }"
        data-cy="stack-trace-link"
      />
      <navigation-link
        id="nav-link-query"
        icon="icon_lost"
        label="Query"
        :to="{ name: 'workflow/query' }"
        data-cy="query-link"
      />
    </navigation-bar>
    <router-view
      name="summary"
      :baseAPIURL="baseAPIURL"
      :date-format="dateFormat"
      :domain="domain"
      :input="summary.input"
      :isWorkflowRunning="summary.isWorkflowRunning"
      :parentWorkflowRoute="summary.parentWorkflowRoute"
      :result="summary.result"
      :time-format="timeFormat"
      :timezone="timezone"
      :wfStatus="summary.wfStatus"
      :workflow="summary.workflow"
      @onNotification="onNotification"
    />
    <router-view
      name="history"
      :baseAPIURL="baseAPIURL"
      :events="historyEvents"
      :isWorkflowRunning="isWorkflowRunning"
      :loading="history.loading"
      :timelineEvents="historyTimelineEvents"
      :workflow-history-event-highlight-list="workflowHistoryEventHighlightList"
      :workflow-history-event-highlight-list-enabled="
        workflowHistoryEventHighlightListEnabled
      "
      @onNotification="onNotification"
      @onWorkflowHistoryEventParamToggle="onWorkflowHistoryEventParamToggle"
    />
    <router-view
      name="stacktrace"
      :baseAPIURL="baseAPIURL"
      :date-format="dateFormat"
      :isWorkerRunning="isWorkerRunning"
      :taskListName="taskList.name"
      :time-format="timeFormat"
      :timezone="timezone"
      @onNotification="onNotification"
    />
    <router-view
      name="query"
      :baseAPIURL="baseAPIURL"
      :isWorkerRunning="isWorkerRunning"
      :taskListName="taskList.name"
      @onNotification="onNotification"
    />
  </section>
</template>

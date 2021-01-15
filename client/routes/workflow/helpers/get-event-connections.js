/* import { eventInfo, event, workflow, eventTypeMap } from "./eventInterface"; */

//Looks for a chronological or inferred child
//It is inferred if a DecisionTaskScheduled, otherwise its chronological
//External signals are not children and therefore they are skipped
function findChild(event, workflow) {
  const slicedWorkflow = workflow.slice(event.eventId);
  let eventInfo = {};
  let targetevent;

  //We are at the end of the workflow, no children!
  if (!slicedWorkflow.length) {
    return eventInfo;
  }

  if (slicedWorkflow[0].eventType === 'DecisionTaskScheduled') {
    eventInfo = {
      inferredChild: slicedWorkflow[0].eventId,
    };

    return eventInfo;
  } else if (event.eventType === 'WorkflowExecutionSignaled') {
    for (targetevent of slicedWorkflow) {
      switch (targetevent.eventType) {
        case 'WorkflowExecutionSignaled':
        case 'WorkflowExecutionCancelRequested':
          break;
        case 'DecisionTaskScheduled':
          eventInfo = {
            inferredChild: targetevent.eventId,
          };

          return eventInfo;
      }
    }
  } else {
    for (targetevent of slicedWorkflow) {
      switch (targetevent.eventType) {
        case 'WorkflowExecutionSignaled':
        case 'WorkflowExecutionCancelRequested':
          break;
        default:
          eventInfo = {
            chronologicalChild: targetevent.eventId,
          };

          return eventInfo;
      }
    }
  }

  return eventInfo;
}

const eventTypeMap = {
  WorkflowExecutionStarted: function(event, workflow) {
    const eventDetails = event.eventFullDetails,
      eventInfo = {
        inferredChild: event.eventId + 1,
        parentWorkflowExecution: eventDetails.parentWorkflowExecution,
        previousExecutionRunId: eventDetails.continuedExecutionRunId,
      };

    return eventInfo;
  },
  ActivityTaskCanceled: function(event) {
    const eventInfo = {
      parent: event.eventFullDetails.startedEventId,
    };

    return eventInfo;
  },
  ActivityTaskCancelRequested: function(event) {
    const eventInfo = {
      parent: event.eventFullDetails.decisionTaskCompletedEventId,
    };

    return eventInfo;
  },
  ActivityTaskCompleted: function(event, workflow) {
    const eventDetails = event.eventFullDetails,
      { inferredChild, chronologicalChild } = findChild(event, workflow),
      eventInfo = {
        parent: eventDetails.startedEventId,
        chronologicalChild: chronologicalChild,
        inferredChild: inferredChild,
      };

    return eventInfo;
  },

  ActivityTaskFailed: function(event, workflow) {
    const eventDetails = event.eventFullDetails,
      { inferredChild, chronologicalChild } = findChild(event, workflow);
    const eventInfo = {
      parent: eventDetails.startedEventId,
      chronologicalChild: chronologicalChild,
      inferredChild: inferredChild,
      status: 'failed',
    };

    return eventInfo;
  },
  ActivityTaskScheduled: function(event) {
    const eventDetails = event.eventFullDetails,
      eventInfo = {
        parent: eventDetails.decisionTaskCompletedEventId,
      };

    return eventInfo;
  },
  ActivityTaskStarted: function(event) {
    const eventDetails = event.eventFullDetails,
      eventInfo = {
        parent: eventDetails.scheduledEventId,
      };

    return eventInfo;
  },
  ActivityTaskTimedOut: function(event, workflow) {
    const { inferredChild, chronologicalChild } = findChild(event, workflow);
    const eventInfo = {
      parent: event.eventFullDetails.startedEventId,
      chronologicalChild: chronologicalChild,
      inferredChild: inferredChild,
    };

    return eventInfo;
  },
  CancelTimerFailed: function(event) {
    const eventInfo = {
      parent: event.eventFullDetails.decisionTaskCompletedEventId,
      status: 'failed',
    };

    return eventInfo;
  },
  ChildWorkflowExecutionCanceled: function(event) {
    const eventInfo = {
      parent: event.eventFullDetails.startedEventId,
    };

    return eventInfo;
  },
  ChildWorkflowExecutionCompleted: function(event, workflow) {
    const eventDetails = event.eventFullDetails,
      { inferredChild, chronologicalChild } = findChild(event, workflow);
    const eventInfo = {
      parent: eventDetails.startedEventId,
      status: 'completed',
      inferredChild: inferredChild,
      chronologicalChild: chronologicalChild,
      childRoute: eventDetails.workflowExecution,
    };

    return eventInfo;
  },
  ChildWorkflowExecutionFailed: function(event, workflow) {
    const eventDetails = event.eventFullDetails,
      { inferredChild, chronologicalChild } = findChild(event, workflow);
    const eventInfo = {
      parent: eventDetails.startedEventId,
      inferredChild: inferredChild,
      chronologicalChild: chronologicalChild,
      childRoute: eventDetails.workflowExecution,
      status: 'failed',
    };

    return eventInfo;
  },
  ChildWorkflowExecutionStarted: function(event, workflow) {
    const eventDetails = event.eventFullDetails,
      { inferredChild, chronologicalChild } = findChild(event, workflow);
    const eventInfo = {
      parent: eventDetails.initiatedEventId,
      inferredChild: inferredChild,
      chronologicalChild: chronologicalChild,
      childRoute: eventDetails.workflowExecution,
    };

    return eventInfo;
  },
  ChildWorkflowExecutionTerminated: function(event) {
    const eventInfo = {
      parent: event.eventFullDetails.startedEventId,
    };

    return eventInfo;
  },
  ChildWorkflowExecutionTimedOut: function(event) {
    const eventInfo = {
      parent: event.eventFullDetails.startedEventId,
    };

    return eventInfo;
  },
  DecisionTaskCompleted: function(event, workflow) {
    const eventInfo = event.eventFullDetails,
      { chronologicalChild } = findChild(event, workflow);

    return {
      parent: eventInfo.startedEventId,
      chronologicalChild: chronologicalChild,
    };
  },
  DecisionTaskFailed: function(event) {
    const eventInfo = {
      status: 'failed',
      parent: event.eventFullDetails.startedEventId,
    };

    return eventInfo;
  },
  DecisionTaskScheduled: function(event, workflow) {
    const eventInfo = {};

    return eventInfo;
  },
  DecisionTaskStarted: function(event) {
    const eventInfo = event.eventFullDetails;

    return {
      parent: eventInfo.scheduledEventId,
    };
  },
  DecisionTaskTimedOut: function(event) {
    const eventInfo = {
      parent: event.eventFullDetails.scheduledEventId,
    };

    return eventInfo;
  },
  ExternalWorkflowExecutionCancelRequested: function(event, workflow) {
    const { inferredChild, chronologicalChild } = findChild(event, workflow);
    const eventInfo = {
      parent: event.eventFullDetails.initiatedEventId,
      inferredChild: inferredChild,
      chronologicalChild: chronologicalChild,
    };

    return eventInfo;
  },
  ExternalWorkflowExecutionSignaled: function(event, workflow) {
    const eventDetails = event.eventFullDetails,
      { inferredChild } = findChild(event, workflow);
    const eventInfo = {
      parent: eventDetails.initiatedEventId,
      inferredChild: inferredChild,
    };

    return eventInfo;
  },
  MarkerRecorded: function(event) {
    const eventDetails = event.eventFullDetails;
    const eventInfo = {
      parent: eventDetails.decisionTaskCompletedEventId,
    };

    return eventInfo;
  },
  RequestCancelActivityTaskFailed: function(event) {
    const eventInfo = {
      status: 'failed',
      parent: event.eventFullDetails.decisionTaskCompletedEventId,
    };

    return eventInfo;
  },
  RequestCancelExternalWorkflowExecutionFailed: function(event) {
    const eventInfo = {
      status: 'failed',
      parent: event.eventFullDetails.decisionTaskCompletedEventId,
    };

    return eventInfo;
  },
  RequestCancelExternalWorkflowExecutionInitiated: function(event) {
    const eventInfo = {
      parent: event.eventFullDetails.decisionTaskCompletedEventId,
    };

    return eventInfo;
  },
  SignalExternalWorkflowExecutionFailed: function(event) {
    const eventInfo = {
      status: 'failed',
      parent: event.eventFullDetails.decisionTaskCompletedEventId,
    };

    return eventInfo;
  },
  SignalExternalWorkflowExecutionInitiated: function(event) {
    const eventDetails = event.eventFullDetails,
      eventInfo = {
        parent: eventDetails.decisionTaskCompletedEventId,
      };

    return eventInfo;
  },
  StartChildWorkflowExecutionFailed: function(event) {
    const eventDetails = event.eventFullDetails,
      eventInfo = {
        status: 'failed',
        parent: eventDetails.decisionTaskCompletedEventId,
      };

    return eventInfo;
  },
  StartChildWorkflowExecutionInitiated: function(event) {
    const eventInfo = {
      parent: event.eventFullDetails.decisionTaskCompletedEventId,
    };

    return eventInfo;
  },
  TimerCanceled: function(event) {
    //TODO
    const eventInfo = {
      parent: event.eventFullDetails.startedEventId,
    };

    return eventInfo;
  },
  TimerFired: function(event, workflow) {
    const eventDetails = event.eventFullDetails,
      { inferredChild } = findChild(event, workflow),
      eventInfo = {
        parent: eventDetails.startedEventId,
        inferredChild: inferredChild,
      };

    return eventInfo;
  },
  TimerStarted: function(event) {
    const eventDetails = event.eventFullDetails,
      eventInfo = {
        parent: eventDetails.decisionTaskCompletedEventId,
      };

    return eventInfo;
  },
  UpsertWorkflowSearchAttributes: function(event) {
    //TODO: not sure about what is important to display here
    const eventDetails = event.eventFullDetails,
      eventInfo = {
        parent: eventDetails.decisionTaskCompletedEventId,
      };

    return eventInfo;
  },
  WorkflowExecutionCanceled: function(event) {
    const eventInfo = {
      parent: event.eventFullDetails.decisionTaskCompletedEventId,
    };

    return eventInfo;
  },
  WorkflowExecutionCancelRequested: function(event, workflow) {
    const { inferredChild } = findChild(event, workflow),
      //This event has no parent nor child
      eventInfo = {
        inferredChild: inferredChild,
      };

    return eventInfo;
  },
  WorkflowExecutionCompleted: function(event) {
    const eventDetails = event.eventFullDetails,
      eventInfo = {
        parent: eventDetails.decisionTaskCompletedEventId,
        status: 'completed',
      };

    return eventInfo;
  },
  WorkflowExecutionContinuedAsNew: function(event) {
    const eventDetails = event.eventFullDetails,
      eventInfo = {
        parent: eventDetails.decisionTaskCompletedEventId,
        newExecutionRunId: eventDetails.newExecutionRunId,
        status: 'completed',
      };

    return eventInfo;
  },
  WorkflowExecutionFailed: function(event) {
    const eventDetails = event.eventFullDetails,
      eventInfo = {
        parent: eventDetails.decisionTaskCompletedEventId,
        status: 'failed',
      };

    return eventInfo;
  },
  WorkflowExecutionSignaled: function(event, workflow) {
    const { inferredChild } = findChild(event, workflow),
      eventInfo = {
        inferredChild: inferredChild,
      };

    return eventInfo;
  },
  WorkflowExecutionTerminated: function(event) {
    const eventInfo = {
      //TODO: parent: event.eventId - 1,
    };

    return eventInfo;
  },
  WorkflowExecutionTimedOut: function(event) {
    //TODO - not sure how to implement.
    const eventInfo = {
      parent: event.eventId - 1,
    };

    return eventInfo;
  },
};

function getEventConnections(event, workflow) {
  return eventTypeMap[event.eventType](event, workflow);
}

// Exporting variables and functions
export { getEventConnections };
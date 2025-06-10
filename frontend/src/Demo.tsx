import React, { useState } from 'react';
import { Check, X, AlertCircle, ArrowRight, Zap, Bot } from 'lucide-react';

// Demo-specific subscription sentences and their mock events
const demoSubscriptions = [
  {
    id: 'github_pr_approved',
    sentence: 'Notify me when PR 1374 is approved',
    source: 'GitHub',
    pattern: 'langhook.events.github.pull_request.1374.updated',
    llmGatePrompt: 'Evaluate if this GitHub pull request event represents an approval for PR #1374. Only approve if the action specifically indicates approval by a reviewer.',
    mockEvents: [
      {
        id: 1,
        description: 'PR 1234 approved by Alice',
        outcome: 'no_match',
        reason: 'Different PR number (1234 vs 1374)',
        canonicalEvent: {
          publisher: 'github',
          resource: { type: 'pull_request', id: 1234 },
          action: 'updated',
          summary: 'PR 1234 approved by Alice'
        }
      },
      {
        id: 2,
        description: 'PR 1374 title changed',
        outcome: 'llm_rejected',
        reason: 'Title change is not an approval',
        canonicalEvent: {
          publisher: 'github',
          resource: { type: 'pull_request', id: 1374 },
          action: 'updated',
          summary: 'PR 1374 title changed'
        }
      },
      {
        id: 3,
        description: 'PR 1374 approved by Alice',
        outcome: 'approved',
        reason: 'Matches PR number and is an approval',
        canonicalEvent: {
          publisher: 'github',
          resource: { type: 'pull_request', id: 1374 },
          action: 'updated',
          summary: 'PR 1374 approved by Alice'
        }
      }
    ]
  },
  {
    id: 'stripe_high_value_refund',
    sentence: 'Alert me when a high-value Stripe refund is issued',
    source: 'Stripe',
    pattern: 'langhook.events.stripe.refund.*.created',
    llmGatePrompt: 'Determine if this Stripe refund event represents a high-value refund (>$500) for a real customer transaction, not a test or low-value refund.',
    mockEvents: [
      {
        id: 1,
        description: 'Refund of $100 issued',
        outcome: 'no_match',
        reason: 'Amount too low for high-value threshold',
        canonicalEvent: {
          publisher: 'stripe',
          resource: { type: 'refund', id: 're_1234' },
          action: 'created',
          summary: 'Refund of $100 issued'
        }
      },
      {
        id: 2,
        description: 'Refund of $800 issued for test customer',
        outcome: 'llm_rejected',
        reason: 'Test transactions are not important',
        canonicalEvent: {
          publisher: 'stripe',
          resource: { type: 'refund', id: 're_5678' },
          action: 'created',
          summary: 'Refund of $800 issued for test customer'
        }
      },
      {
        id: 3,
        description: 'Refund of $950 issued for real transaction',
        outcome: 'approved',
        reason: 'High-value refund for real customer',
        canonicalEvent: {
          publisher: 'stripe',
          resource: { type: 'refund', id: 're_9012' },
          action: 'created',
          summary: 'Refund of $950 issued for real transaction'
        }
      }
    ]
  },
  {
    id: 'jira_ticket_done',
    sentence: 'Tell me when a Jira ticket is moved to Done',
    source: 'Jira',
    pattern: 'langhook.events.jira.issue.*.updated',
    llmGatePrompt: 'Assess if this Jira issue update represents a ticket being properly moved to "Done" status by an authorized team member.',
    mockEvents: [
      {
        id: 1,
        description: 'Ticket moved to "In Progress"',
        outcome: 'no_match',
        reason: 'Status changed but not to Done',
        canonicalEvent: {
          publisher: 'jira',
          resource: { type: 'issue', id: 'PROJ-123' },
          action: 'updated',
          summary: 'Ticket moved to "In Progress"'
        }
      },
      {
        id: 2,
        description: 'Ticket moved to Done: unassigned',
        outcome: 'llm_rejected',
        reason: 'Unassigned tickets may not be truly complete',
        canonicalEvent: {
          publisher: 'jira',
          resource: { type: 'issue', id: 'PROJ-456' },
          action: 'updated',
          summary: 'Ticket moved to Done: unassigned'
        }
      },
      {
        id: 3,
        description: 'Ticket moved to Done by product owner',
        outcome: 'approved',
        reason: 'Properly completed by authorized person',
        canonicalEvent: {
          publisher: 'jira',
          resource: { type: 'issue', id: 'PROJ-789' },
          action: 'updated',
          summary: 'Ticket moved to Done by product owner'
        }
      }
    ]
  },
  {
    id: 'slack_file_upload',
    sentence: 'Ping me when someone uploads a file to Slack',
    source: 'Slack',
    pattern: 'langhook.events.slack.file.*.created',
    llmGatePrompt: 'Evaluate if this Slack file upload event contains an important business document rather than casual or irrelevant files.',
    mockEvents: [
      {
        id: 1,
        description: 'Message posted (not a file)',
        outcome: 'no_match',
        reason: 'Not a file upload event',
        canonicalEvent: {
          publisher: 'slack',
          resource: { type: 'message', id: 'msg_123' },
          action: 'created',
          summary: 'Message posted (not a file)'
        }
      },
      {
        id: 2,
        description: 'File uploaded with no context',
        outcome: 'llm_rejected',
        reason: 'Random file uploads may not be important',
        canonicalEvent: {
          publisher: 'slack',
          resource: { type: 'file', id: 'file_456' },
          action: 'created',
          summary: 'File uploaded with no context'
        }
      },
      {
        id: 3,
        description: 'File uploaded titled "Quarterly Results.pdf"',
        outcome: 'approved',
        reason: 'Important business document',
        canonicalEvent: {
          publisher: 'slack',
          resource: { type: 'file', id: 'file_789' },
          action: 'created',
          summary: 'File uploaded titled "Quarterly Results.pdf"'
        }
      }
    ]
  },
  {
    id: 'important_email',
    sentence: 'Let me know if an important email arrives',
    source: 'Email',
    pattern: 'langhook.events.email.message.*.received',
    llmGatePrompt: 'Determine if this email event represents an important message that requires immediate attention, rather than routine or marketing emails.',
    mockEvents: [
      {
        id: 1,
        description: 'Email from newsletter@example.com',
        outcome: 'no_match',
        reason: 'Marketing emails are filtered out',
        canonicalEvent: {
          publisher: 'email',
          resource: { type: 'message', id: 'email_123' },
          action: 'received',
          summary: 'Email from newsletter@example.com'
        }
      },
      {
        id: 2,
        description: 'Email from CEO: "FYI draft for later"',
        outcome: 'llm_rejected',
        reason: 'FYI emails are not urgent',
        canonicalEvent: {
          publisher: 'email',
          resource: { type: 'message', id: 'email_456' },
          action: 'received',
          summary: 'Email from CEO: "FYI draft for later"'
        }
      },
      {
        id: 3,
        description: 'Email from CEO: "Board slides for tomorrow"',
        outcome: 'approved',
        reason: 'Urgent request from leadership',
        canonicalEvent: {
          publisher: 'email',
          resource: { type: 'message', id: 'email_789' },
          action: 'received',
          summary: 'Email from CEO: "Board slides for tomorrow"'
        }
      }
    ]
  }
];

const Demo: React.FC = () => {
  const [selectedSubscription, setSelectedSubscription] = useState(demoSubscriptions[0]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showProcessing, setShowProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasAddedSubscription, setHasAddedSubscription] = useState(false);
  const [isAddingSubscription, setIsAddingSubscription] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(false);

  const handleAddSubscription = async () => {
    setIsAddingSubscription(true);
    
    // Show loading for 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsAddingSubscription(false);
    setHasAddedSubscription(true);
  };

  const handleStartOver = () => {
    setSelectedSubscription(demoSubscriptions[0]);
    setSelectedEvent(null);
    setShowProcessing(false);
    setCurrentStep(0);
    setHasAddedSubscription(false);
    setIsAddingSubscription(false);
    setProcessingComplete(false);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEventProcess = async (event: any) => {
    setSelectedEvent(event);
    setShowProcessing(true);
    setCurrentStep(0);
    setProcessingComplete(false);
    
    // Scroll to the processing section
    setTimeout(() => {
      const processingSection = document.querySelector('[data-processing-section]');
      if (processingSection) {
        processingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    
    // Simulate processing steps with delays, starting from ingestion
    const steps = [
      { name: 'Ingested Payload → Canonical Format', delay: 1500 },
      { name: 'Pattern Matching', delay: 1000 },
      { name: 'LLM Gate Evaluation', delay: 2000 },
      { name: 'Final Decision', delay: 500 }
    ];
    
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, steps[i].delay));
      setCurrentStep(i + 1);
    }
    
    // Keep final result visible and show completion
    setProcessingComplete(true);
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'no_match': return <X size={16} className="text-red-600" />;
      case 'llm_rejected': return <AlertCircle size={16} className="text-yellow-600" />;
      case 'approved': return <Check size={16} className="text-green-600" />;
      default: return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Steps 1 and 2 in same row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1: Choose Subscription */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold mb-2 text-gray-800 flex items-center gap-2">
            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">1</span>
            Subscribe using natural language
          </h2>
          <p className="text-sm md:text-base text-gray-600 mb-6">Enter a natural language query to create an event subscription.</p>
          
          <div className="grid gap-3 md:gap-4">
            {(!hasAddedSubscription && !isAddingSubscription ? demoSubscriptions : [selectedSubscription]).map((subscription) => (
              <button
                key={subscription.id}
                onClick={() => !isAddingSubscription && !hasAddedSubscription && setSelectedSubscription(subscription)}
                disabled={isAddingSubscription || hasAddedSubscription}
                className={`text-left p-3 md:p-4 rounded-lg border-2 transition-all ${
                  selectedSubscription.id === subscription.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                } ${isAddingSubscription || hasAddedSubscription ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Check size={18} className="text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm md:text-base">"{subscription.sentence}"</div>
                    <div className="text-xs md:text-sm text-gray-500">{subscription.source}</div>
                  </div>
                  {selectedSubscription.id === subscription.id && (
                    <ArrowRight size={18} className="text-blue-600 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Add subscription button */}
          <div className="mt-6">
            <button
              onClick={handleAddSubscription}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-75 disabled:cursor-not-allowed"
              disabled={hasAddedSubscription || isAddingSubscription}
            >
              {hasAddedSubscription ? '✓ Subscription Added' : 
               isAddingSubscription ? (
                 <span className="flex items-center justify-center gap-2">
                   <div className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
                   Adding Subscription...
                 </span>
               ) : 'Add Subscription'}
            </button>
          </div>

          {/* Show generated pattern and LLM Gate prompt */}
          {hasAddedSubscription && (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg border">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Generated Subject Filter:</h3>
                <code className="text-sm font-mono text-blue-600">{selectedSubscription.pattern}</code>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border">
                <h3 className="text-sm font-medium text-gray-700 mb-2">LLM Gate Prompt:</h3>
                <p className="text-sm text-gray-600">{selectedSubscription.llmGatePrompt}</p>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Ingest new event (only show after subscription added) */}
        {hasAddedSubscription && (
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-gray-800 flex items-center gap-2">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">2</span>
              Ingest new event
            </h2>
            <p className="text-sm md:text-base text-gray-600 mb-6">
              Source systems send webhook events to LangHook. Try ingesting sample events to see how they're processed:
            </p>
            
            <div className="grid gap-3 md:gap-4">
              {selectedSubscription.mockEvents.map((event) => (
                <div
                  key={event.id}
                  className="border border-gray-200 rounded-lg p-3 md:p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 mb-2 text-sm md:text-base">📦 {event.description}</div>
                    </div>
                    <button
                      onClick={() => handleEventProcess(event)}
                      className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs md:text-sm font-medium flex-shrink-0"
                      disabled={showProcessing}
                    >
                      {showProcessing && selectedEvent?.id === event.id ? 'Processing...' : 'Ingest Event'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Processing Timeline - Full width, horizontal layout */}
      {showProcessing && selectedEvent && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6" data-processing-section>
          <h2 className="text-xl font-semibold mb-6 text-gray-800 flex items-center gap-2">
            <Zap size={24} className="text-blue-600" />
            What Happens Inside LangHook
          </h2>
          
          {/* Horizontal steps layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Step 1: Payload to Canonical */}
            <div className={`p-4 rounded-lg transition-all ${
              currentStep >= 1 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 1 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  1
                </div>
                <h3 className="font-medium text-gray-900 text-sm">Ingestion</h3>
              </div>
              <div className="text-xs text-gray-600 mb-2">
                Raw webhook → Canonical format
              </div>
              {currentStep >= 1 && (
                <div className="text-xs bg-white rounded border p-2">
                  <pre className="text-xs overflow-x-auto">{JSON.stringify(selectedEvent.canonicalEvent, null, 1)}</pre>
                </div>
              )}
              {currentStep >= 1 && <Check size={16} className="text-green-600 mt-2" />}
            </div>

            {/* Step 2: Pattern Matching */}
            <div className={`p-4 rounded-lg transition-all ${
              currentStep >= 2 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 2 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  2
                </div>
                <h3 className="font-medium text-gray-900 text-sm">Pattern Match</h3>
              </div>
              <div className="text-xs text-gray-600 mb-2">
                Subject vs subscription filter
              </div>
              {currentStep >= 2 && (
                <div className="text-xs">
                  {selectedEvent.outcome !== 'no_match' ? '✅ Match' : '❌ No match'}
                </div>
              )}
              {currentStep >= 2 && <Check size={16} className="text-green-600 mt-2" />}
            </div>

            {/* Step 3: LLM Gate (conditional) */}
            {selectedEvent.outcome !== 'no_match' && (
              <div className={`p-4 rounded-lg transition-all ${
                currentStep >= 3 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= 3 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    3
                  </div>
                  <div className="flex items-center gap-1">
                    <Bot size={14} />
                    <h3 className="font-medium text-gray-900 text-sm">LLM Gate</h3>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  AI relevance evaluation
                </div>
                {currentStep >= 3 && (
                  <div className="text-xs">
                    <div className={`px-2 py-1 rounded text-xs ${
                      selectedEvent.outcome === 'approved' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedEvent.outcome === 'approved' ? '✅ Approved' : '🚫 Rejected'}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{selectedEvent.reason}</div>
                  </div>
                )}
                {currentStep >= 3 && <Check size={16} className="text-green-600 mt-2" />}
              </div>
            )}

            {/* Step 4: Final Decision */}
            <div className={`p-4 rounded-lg transition-all ${
              currentStep >= 4 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 4 ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  4
                </div>
                <h3 className="font-medium text-gray-900 text-sm">Final Action</h3>
              </div>
              <div className="text-xs text-gray-600 mb-2">
                Notification decision
              </div>
              {currentStep >= 4 && (
                <div className="text-xs">
                  <div className={`px-2 py-1 rounded text-xs ${
                    selectedEvent.outcome === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : selectedEvent.outcome === 'llm_rejected'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {getOutcomeIcon(selectedEvent.outcome)}
                    {selectedEvent.outcome === 'approved' && '📬 Sent'}
                    {selectedEvent.outcome === 'llm_rejected' && '🤖 Filtered'}
                    {selectedEvent.outcome === 'no_match' && '📭 Discarded'}
                  </div>
                </div>
              )}
              {currentStep >= 4 && <Check size={16} className="text-blue-600 mt-2" />}
            </div>
          </div>
          
          {/* Start Over button when processing is complete */}
          {processingComplete && (
            <div className="mt-6 text-center">
              <button
                onClick={handleStartOver}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                🔄 Start Over
              </button>
              <p className="text-sm text-gray-600 mt-2">
                Try again or choose different events to ingest
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default Demo;
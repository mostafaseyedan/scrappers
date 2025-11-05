"""
Algolia Handler using Gemini Function Calling
Registers Algolia search as a tool that Gemini can automatically invoke
"""
import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from algoliasearch.search.client import SearchClient
from algoliasearch.search.models import SearchParamsObject
from google import genai
from google.genai import types
import chainlit as cl
from dotenv import load_dotenv

load_dotenv()


class AlgoliaGeminiTool:
    """Algolia search integrated as a Gemini function calling tool"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize with Algolia and Gemini clients"""
        if config is None:
            config = {}

        # Algolia configuration
        self.app_id = config.get("algolia_app_id") or os.getenv("ALGOLIA_APP_ID")
        self.api_key = config.get("algolia_search_api_key") or os.getenv("ALGOLIA_SEARCH_API_KEY")
        self.index_name = config.get("algolia_index") or os.getenv("ALGOLIA_INDEX_NAME", "solicitations")

        # Gemini configuration
        self.gemini_api_key = config.get("gemini_api_key") or os.getenv("GEMINI_API_KEY")
        self.model_name = config.get("model", "gemini-flash-latest")

        # Validation
        if not self.app_id or not self.api_key:
            raise ValueError("Missing Algolia configuration")
        if not self.gemini_api_key:
            raise ValueError("Missing Gemini API key")

        # Initialize Algolia client
        self.algolia_client = SearchClient(self.app_id, self.api_key)

        # Initialize Gemini client
        self.gemini_client = genai.Client(
            api_key=self.gemini_api_key,
            vertexai=False
        )

        # Store chat sessions per thread_id for conversation persistence
        self.chat_sessions = {}

        # Schema information - will be populated on first use
        self.schema_info = None

        print(f"Initialized AlgoliaGeminiTool: index={self.index_name}, model={self.model_name}")

    async def _discover_schema(self) -> Dict[str, Any]:
        """
        Discover schema by sampling documents from Algolia
        Returns information about available fields for filtering
        """
        if self.schema_info:
            return self.schema_info

        try:
            # Sample a few documents to discover schema
            search_params = SearchParamsObject(
                query="",  # Empty query to get any documents
                hits_per_page=3
            )

            results = await self.algolia_client.search_single_index(
                index_name=self.index_name,
                search_params=search_params
            )

            hits = results.hits if hasattr(results, 'hits') else []

            if hits:
                # Get first hit to inspect fields
                sample_hit = hits[0]
                if hasattr(sample_hit, 'model_dump'):
                    sample_dict = sample_hit.model_dump()
                else:
                    sample_dict = sample_hit

                # Identify date fields
                date_fields = []
                for key, value in sample_dict.items():
                    if isinstance(value, int) and key.lower() in ['publishdate', 'closingdate', 'created', 'updated', 'posteddate']:
                        date_fields.append(key)

                self.schema_info = {
                    "date_fields": date_fields,
                    "sample_keys": list(sample_dict.keys())
                }

                print(f"Discovered schema - Date fields: {date_fields}")
                return self.schema_info

        except Exception as e:
            print(f"Schema discovery failed: {e}")
            # Fallback to known fields
            self.schema_info = {
                "date_fields": ["publishDate", "closingDate", "created", "updated"],
                "sample_keys": ["title", "location", "site", "categories", "keywords"]
            }

        return self.schema_info

    def _parse_date_range(self, date_range: str = "") -> str:
        """
        Convert natural language date range to Algolia filter string

        Args:
            date_range: Natural language like "past_month", "past_week", "past_7_days",
                       "today", "yesterday", or custom like "2025-01-01_to_2025-01-31"

        Returns:
            Algolia filter string for created field
        """
        if not date_range:
            return ""

        from datetime import datetime, timedelta

        now = datetime.now()

        # Convert to lowercase for case-insensitive matching
        date_range = date_range.lower().strip()

        if date_range == "today":
            start = datetime(now.year, now.month, now.day, 0, 0, 0)
            end = datetime(now.year, now.month, now.day, 23, 59, 59)
        elif date_range == "yesterday":
            yesterday = now - timedelta(days=1)
            start = datetime(yesterday.year, yesterday.month, yesterday.day, 0, 0, 0)
            end = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59)
        elif date_range == "past_week" or date_range == "past_7_days":
            start = now - timedelta(days=7)
            end = now
        elif date_range == "past_month" or date_range == "past_30_days":
            start = now - timedelta(days=30)
            end = now
        elif date_range == "past_3_months" or date_range == "past_90_days":
            start = now - timedelta(days=90)
            end = now
        elif "_to_" in date_range:
            # Custom range like "2025-01-01_to_2025-01-31"
            try:
                start_str, end_str = date_range.split("_to_")
                start = datetime.strptime(start_str.strip(), "%Y-%m-%d")
                end = datetime.strptime(end_str.strip(), "%Y-%m-%d")
                end = datetime(end.year, end.month, end.day, 23, 59, 59)
            except:
                return ""
        else:
            return ""

        # Convert to Unix timestamps in milliseconds
        start_ts = int(start.timestamp() * 1000)
        end_ts = int(end.timestamp() * 1000)

        return f"created>={start_ts} AND created<={end_ts}"

    async def _search_algolia_tool(self, query: str, filters: str = "", hits_per_page: int = 5, date_range: str = "") -> str:
        """
        The actual search function that Gemini will call
        Returns JSON string of results for Gemini to process

        Args:
            query: Search keywords
            filters: Advanced Algolia filter string
            hits_per_page: Number of results to return
            date_range: Natural language date range (e.g., "past_month", "today", "past_week")
        """
        try:
            # Parse date range into filter if provided
            date_filter = self._parse_date_range(date_range) if date_range else ""

            # Combine date filter with custom filters
            combined_filters = ""
            if date_filter and filters:
                combined_filters = f"({date_filter}) AND ({filters})"
            elif date_filter:
                combined_filters = date_filter
            elif filters:
                combined_filters = filters

            # Build search parameters
            search_params = SearchParamsObject(
                query=query,
                hits_per_page=hits_per_page,
                attributes_to_retrieve=["*"]
            )

            # Add combined filters if any
            if combined_filters:
                search_params.filters = combined_filters

            # Execute search
            results = await self.algolia_client.search_single_index(
                index_name=self.index_name,
                search_params=search_params
            )

            # Extract and format hits
            hits = results.hits if hasattr(results, 'hits') else []
            total_hits = results.nb_hits if hasattr(results, 'nb_hits') else len(hits)
            formatted_results = []

            for hit in hits:
                if hasattr(hit, 'model_dump'):
                    hit_dict = hit.model_dump()
                else:
                    hit_dict = hit

                # Format each result
                result = {
                    "title": hit_dict.get("title", "Untitled"),
                    "description": hit_dict.get("description", ""),
                    "issuer": hit_dict.get("issuer", ""),
                    "location": hit_dict.get("location", ""),
                    "site": hit_dict.get("site", ""),
                    "siteUrl": hit_dict.get("siteUrl", ""),
                    "scrapedDate": self._format_timestamp(hit_dict.get("created")),
                    "closingDate": self._format_timestamp(hit_dict.get("closingDate")),
                    "publishDate": self._format_timestamp(hit_dict.get("publishDate")),
                    "questionsDueByDate": self._format_timestamp(hit_dict.get("questionsDueByDate")),
                    "cnStatus": hit_dict.get("cnStatus", ""),
                    "cnType": hit_dict.get("cnType", ""),
                    "categories": hit_dict.get("categories", []),
                    "keywords": hit_dict.get("keywords", [])
                }
                formatted_results.append(result)

            # Return as JSON string for Gemini with total count
            return json.dumps({
                "success": True,
                "total_matching_rfps": total_hits,
                "returned_results": len(formatted_results),
                "results": formatted_results
            }, indent=2)

        except Exception as e:
            return json.dumps({
                "success": False,
                "error": str(e)
            })

    def _format_timestamp(self, timestamp) -> Optional[str]:
        """Convert timestamp to readable date"""
        if not timestamp:
            return None
        try:
            return datetime.fromtimestamp(timestamp / 1000).strftime('%Y-%m-%d')
        except:
            return None

    async def _get_statistics_tool(self, facet_by: str, filters: str = "", date_range: str = "") -> str:
        """
        Get statistical analysis using Algolia faceting
        Returns aggregated counts grouped by the specified facet field

        Args:
            facet_by: Field to facet by - "cnStatus", "location", "site"
            filters: Optional Algolia filter string
            date_range: Optional date range for time-based analysis

        Returns:
            JSON string with statistical breakdown
        """
        try:
            # Parse date range into filter if provided
            date_filter = self._parse_date_range(date_range) if date_range else ""

            # Combine date filter with custom filters
            combined_filters = ""
            if date_filter and filters:
                combined_filters = f"({date_filter}) AND ({filters})"
            elif date_filter:
                combined_filters = date_filter
            elif filters:
                combined_filters = filters

            # Build search parameters for faceting
            search_params = SearchParamsObject(
                query="",  # Empty query to get all results
                hits_per_page=0,  # Don't need actual documents, just stats
                facets=[facet_by]
            )

            # Add combined filters if any
            if combined_filters:
                search_params.filters = combined_filters

            # Execute search with faceting
            results = await self.algolia_client.search_single_index(
                index_name=self.index_name,
                search_params=search_params
            )

            # Extract facet data
            total_rfps = results.nb_hits if hasattr(results, 'nb_hits') else 0
            facet_data = {}

            if hasattr(results, 'facets') and results.facets and facet_by in results.facets:
                facet_data = results.facets[facet_by]

            # Format facet results with percentages
            breakdown = []
            for value, count in sorted(facet_data.items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_rfps * 100) if total_rfps > 0 else 0
                breakdown.append({
                    "value": value,
                    "count": count,
                    "percentage": round(percentage, 2)
                })

            # Return as JSON string for Gemini
            return json.dumps({
                "success": True,
                "total_rfps": total_rfps,
                "facet_field": facet_by,
                "date_range": date_range if date_range else "all_time",
                "breakdown": breakdown
            }, indent=2)

        except Exception as e:
            return json.dumps({
                "success": False,
                "error": str(e)
            })

    async def _create_search_tool_declaration(self) -> types.Tool:
        """
        Create the Gemini function declaration for Algolia search
        This tells Gemini how to call our search function with correct schema
        """
        # Discover schema first
        schema = await self._discover_schema()
        date_fields = schema.get("date_fields", ["publishDate", "closingDate"])

        # Build filter description with actual field names
        date_fields_str = ", ".join(date_fields)
        filter_description = (
            f"Optional Algolia filter string for refined search. "
            f"Available date fields: {date_fields_str}. "
            f"IMPORTANT DATE FIELD MEANINGS:\n"
            f"- 'created': When the RFP was SCRAPED/ADDED to our database (use this for 'scrapped on' questions)\n"
            f"- 'publishDate': When the RFP was originally published on the source website\n"
            f"- 'closingDate': Submission deadline for the RFP\n"
            f"- 'updated': When the record was last modified\n\n"
            f"Date filter examples: 'created>=1728518400000 AND created<=1728604799000' for RFPs scraped in a date range. "
            f"Location example: 'location:California'. Category example: 'categories:IT Services'. "
            f"IMPORTANT: All dates must be Unix timestamps in milliseconds (not seconds)."
        )

        search_function = types.FunctionDeclaration(
            name="search_rfp_database",
            description=(
                "Search the RFP (Request for Proposal) and solicitations database. "
                "Use this tool to find government contracts, RFPs, bids, and procurement opportunities. "
                "You can search by keywords, filter by date ranges, locations, or categories. "
                "The database contains information about IT services, managed services, consulting, and other government contracts."
            ),
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "query": types.Schema(
                        type=types.Type.STRING,
                        description="The search keywords or terms. For company/product names (Infor, Microsoft, Oracle, SAP, etc.), use the EXACT name only. For general topics, use descriptive terms (e.g., 'IT managed services', 'consulting', 'cloud migration')"
                    ),
                    "filters": types.Schema(
                        type=types.Type.STRING,
                        description=filter_description
                    ),
                    "date_range": types.Schema(
                        type=types.Type.STRING,
                        description=(
                            "Simplified date filtering for when RFPs were scraped. "
                            "Options: 'today', 'yesterday', 'past_week', 'past_month', 'past_3_months', "
                            "or custom range like 'YYYY-MM-DD_to_YYYY-MM-DD'. "
                            "Use this instead of manually constructing date filters."
                        )
                    ),
                    "hits_per_page": types.Schema(
                        type=types.Type.INTEGER,
                        description="Number of results to return (default: 5, max: 50). For statistical counts, you only need 1 result since total_matching_rfps is returned."
                    )
                },
                required=["query"]
            )
        )

        # Statistics function declaration
        statistics_function = types.FunctionDeclaration(
            name="get_rfp_statistics",
            description=(
                "Get statistical analysis and trends from the RFP database using aggregation. "
                "Use this for questions about patterns, trends, distributions, and percentages. "
                "Examples: 'What % of RFPs are we pursuing?', 'Which states have most RFPs?', "
                "'What are the trends?', 'How many RFPs by pursuit status?'"
            ),
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "facet_by": types.Schema(
                        type=types.Type.STRING,
                        description=(
                            "Field to group/aggregate by for statistics. Options:\n"
                            "- 'cnStatus': Pursuit status breakdown (pursuing, notPursuing, monitor, researching, submitted)\n"
                            "- 'location': Geographic distribution by state/region\n"
                            "- 'site': Distribution by RFP source website\n"
                            "Use cnStatus for pursuit trends and patterns."
                        )
                    ),
                    "filters": types.Schema(
                        type=types.Type.STRING,
                        description="Optional filters to narrow statistics (same format as search_rfp_database filters)"
                    ),
                    "date_range": types.Schema(
                        type=types.Type.STRING,
                        description=(
                            "Time period for analysis. Same options as search_rfp_database: "
                            "'today', 'yesterday', 'past_week', 'past_month', 'past_3_months', "
                            "or 'YYYY-MM-DD_to_YYYY-MM-DD'. Use for time-based trend analysis."
                        )
                    )
                },
                required=["facet_by"]
            )
        )

        return types.Tool(function_declarations=[search_function, statistics_function])

    async def _get_or_create_chat_session(self, thread_id: str = None):
        """Get existing chat session or create a new one for the thread"""
        if not thread_id:
            thread_id = "default"

        if thread_id not in self.chat_sessions:
            # Create the search tool with discovered schema
            search_tool = await self._create_search_tool_declaration()

            # System instruction for the model with current date context
            from datetime import datetime
            current_date = datetime.now()
            current_date_str = current_date.strftime('%B %d, %Y')
            current_timestamp = int(current_date.timestamp() * 1000)

            system_instruction = f""" You are an expert at finding and searching RFP documents.   
You have full access to Cendien's (our company) internal database of scrapped and found RFPs.
Answer the user's question based on the provided context from knowledge base.
If the context doesn't contain relevant information, say so politely.

TODAY'S DATE: {current_date_str} (Unix timestamp: {current_timestamp} milliseconds)

CRITICAL: You MUST ALWAYS use the search_rfp_database tool to answer questions. Never respond without calling the search tool first.

When answering questions:
1. ALWAYS call search_rfp_database tool first before responding
2. Analyze what the user is asking for and extract relevant keywords
   - For company/product names (like "Infor", "Microsoft", "Oracle"), use exact matching with quotes in the query
   - Example: User asks "Infor RFP" -> search with query="Infor" (exact match), NOT "information"
3. If filtering by dates, convert natural language dates to Unix timestamps in milliseconds
   - Use TODAY'S DATE above as reference for relative dates (e.g., "yesterday", "last week", "this month")
4. After getting search results, present them clearly with titles, locations, closing dates, and URLs
5. If no results are found, suggest alternative searches or broader keywords
6. Be helpful and provide actionable information"""

            # Create chat session with tools
            self.chat_sessions[thread_id] = self.gemini_client.aio.chats.create(
                model=self.model_name,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    tools=[search_tool],
                    temperature=0.7,
                    max_output_tokens=2048,
                    tool_config=types.ToolConfig(
                        function_calling_config=types.FunctionCallingConfig(
                            mode=types.FunctionCallingConfigMode.AUTO
                        )
                    )
                )
            )
            print(f"Created new chat session for thread: {thread_id}")

        return self.chat_sessions[thread_id]

    async def stream_response(self, user_query: str, thread_id: str = None) -> Dict[str, Any]:
        """
        Stream response using Gemini with function calling (Chainlit integration)
        This is the main method to use with Chainlit

        Args:
            user_query: User's question
            thread_id: Thread ID for conversation persistence
        """
        try:
            # Create message for streaming
            msg = cl.Message(content="")
            await msg.send()

            # Get or create chat session for this thread
            chat_session = await self._get_or_create_chat_session(thread_id)

            # Send message to chat session
            print(f"Algolia Gemini Tool: Processing query for thread {thread_id}: {user_query}")
            response = await chat_session.send_message(user_query)

            # Check if Gemini wants to call the function
            function_calls = []
            if response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        function_calls.append(part.function_call)

            # Execute function calls
            function_responses = []
            search_results = []
            if function_calls:
                print(f"Gemini is calling {len(function_calls)} function(s)")
                for fc in function_calls:
                    print(f"  Function: {fc.name}")
                    print(f"  Args: {fc.args}")

                    # Execute the appropriate function
                    if fc.name == "search_rfp_database":
                        function_result = await self._search_algolia_tool(
                            query=fc.args.get("query", ""),
                            filters=fc.args.get("filters", ""),
                            hits_per_page=fc.args.get("hits_per_page", 5),
                            date_range=fc.args.get("date_range", "")
                        )

                        # Parse results for source tracking
                        import json
                        result_data = json.loads(function_result)
                        if result_data.get("success") and result_data.get("results"):
                            search_results.extend(result_data["results"])

                    elif fc.name == "get_rfp_statistics":
                        function_result = await self._get_statistics_tool(
                            facet_by=fc.args.get("facet_by", "cnStatus"),
                            filters=fc.args.get("filters", ""),
                            date_range=fc.args.get("date_range", "")
                        )

                        # For statistics, add a metadata entry to show total analyzed
                        import json
                        result_data = json.loads(function_result)
                        if result_data.get("success") and result_data.get("total_rfps"):
                            # Add a summary entry to sources
                            search_results.append({
                                "title": f"Statistical Analysis of {result_data['total_rfps']} RFPs",
                                "description": f"Analyzed by {result_data.get('facet_field', 'field')}",
                                "siteUrl": "",
                                "site": "Statistics",
                                "scrapedDate": "",
                                "closingDate": ""
                            })
                    else:
                        function_result = json.dumps({"success": False, "error": f"Unknown function: {fc.name}"})

                    # Create function response
                    function_responses.append(
                        types.Part(
                            function_response=types.FunctionResponse(
                                name=fc.name,
                                response={"result": function_result}
                            )
                        )
                    )

                # Send function results back to chat session
                final_response = await chat_session.send_message(function_responses)

                # Stream the response text
                if final_response.text:
                    await msg.stream_token(final_response.text)
            else:
                # No function call needed - stream direct response
                await msg.stream_token(response.text)

            await msg.update()

            return {
                "success": True,
                "function_calls": len(function_calls),
                "sources": search_results,
                "message": msg
            }

        except Exception as e:
            error_msg = f"Error generating response: {str(e)}"
            print(error_msg)
            import traceback
            traceback.print_exc()
            await msg.stream_token(error_msg)
            await msg.update()
            return {
                "success": False,
                "error": str(e),
                "sources": []
            }

    async def generate_response_with_tools(self, user_query: str) -> Dict[str, Any]:
        """
        Generate response using Gemini with function calling
        Gemini will automatically decide when and how to call the search tool
        """
        try:
            # Create the search tool
            search_tool = await self._create_search_tool_declaration()

            # System instruction for the model
            system_instruction = """You are an expert assistant for finding RFPs and government solicitations.
You have access to a search tool that can query our solicitations database.

When answering questions:
1. Analyze what the user is asking for
2. Use the search_rfp_database tool with appropriate parameters
3. Present results clearly with titles, locations, closing dates, and URLs
4. If filtering by dates, convert natural language dates to Unix timestamps (in milliseconds)
5. Be helpful and provide actionable information"""

            # Create the generation config with tools
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=[search_tool],
                temperature=0.7,
                max_output_tokens=2048
            )

            # Initial request to Gemini
            print(f"\nUser Query: {user_query}")
            response = await self.gemini_client.aio.models.generate_content(
                model=self.model_name,
                contents=user_query,
                config=config
            )

            # Check if Gemini wants to call the function
            function_calls = []
            if response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        function_calls.append(part.function_call)

            # Execute function calls
            function_responses = []
            if function_calls:
                print(f"\nGemini is calling {len(function_calls)} function(s)")
                for fc in function_calls:
                    print(f"  Function: {fc.name}")
                    print(f"  Args: {fc.args}")

                    # Execute the appropriate function
                    if fc.name == "search_rfp_database":
                        function_result = await self._search_algolia_tool(
                            query=fc.args.get("query", ""),
                            filters=fc.args.get("filters", ""),
                            hits_per_page=fc.args.get("hits_per_page", 5),
                            date_range=fc.args.get("date_range", "")
                        )
                    elif fc.name == "get_rfp_statistics":
                        function_result = await self._get_statistics_tool(
                            facet_by=fc.args.get("facet_by", "cnStatus"),
                            filters=fc.args.get("filters", ""),
                            date_range=fc.args.get("date_range", "")
                        )

                        # For statistics, add a metadata entry to show total analyzed
                        import json
                        result_data = json.loads(function_result)
                        if result_data.get("success") and result_data.get("total_rfps"):
                            # Add a summary entry to sources
                            search_results.append({
                                "title": f"Statistical Analysis of {result_data['total_rfps']} RFPs",
                                "description": f"Analyzed by {result_data.get('facet_field', 'field')}",
                                "siteUrl": "",
                                "site": "Statistics",
                                "scrapedDate": "",
                                "closingDate": ""
                            })
                    else:
                        function_result = json.dumps({"success": False, "error": f"Unknown function: {fc.name}"})

                    # Create function response
                    function_responses.append(
                        types.Part(
                            function_response=types.FunctionResponse(
                                name=fc.name,
                                response={"result": function_result}
                            )
                        )
                    )

                # Send function results back to Gemini for final answer
                final_response = await self.gemini_client.aio.models.generate_content(
                    model=self.model_name,
                    contents=[
                        types.Content(role="user", parts=[types.Part(text=user_query)]),
                        types.Content(role="model", parts=response.candidates[0].content.parts),
                        types.Content(role="user", parts=function_responses)
                    ],
                    config=config
                )

                answer = final_response.text
            else:
                # No function call needed
                answer = response.text

            return {
                "answer": answer,
                "function_calls": len(function_calls),
                "success": True
            }

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "answer": f"Error generating response: {str(e)}",
                "success": False,
                "error": str(e)
            }

    async def close(self):
        """Close clients"""
        try:
            await self.algolia_client.close()
        except:
            pass


# Test function
if __name__ == "__main__":
    import asyncio

    async def test():
        tool = None
        try:
            tool = AlgoliaGeminiTool()

            # Test with the user's original question
            queries = [
                "Is there any RFP about IT managed service between October 10 to October 20?",
                "Show me managed services opportunities closing in November 2025",
                "Find RFPs in California for cloud services"
            ]

            for query in queries:
                print(f"\n{'='*70}")
                print(f"Testing: {query}")
                print('='*70)

                result = await tool.generate_response_with_tools(query)

                print(f"\nAnswer:\n{result['answer']}\n")
                print(f"Function calls made: {result.get('function_calls', 0)}")

        except Exception as e:
            print(f"Test failed: {e}")
            import traceback
            traceback.print_exc()
        finally:
            if tool:
                await tool.close()

    asyncio.run(test())
